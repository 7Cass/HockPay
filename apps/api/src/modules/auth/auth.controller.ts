import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  LoginUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
  SwitchStoreUseCase,
  ISwitchStoreOutput,
  InvalidRefreshTokenError,
  RefreshTokenRevokedError,
  TokenExpiredError,
} from '@hockpay/core';
import {
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
} from './dtos/login.dto';
import {
  THROTTLE_LOGIN_LIMIT,
  THROTTLE_TTL_MS,
} from '../../common/throttle-config';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserData } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

/**
 * Base cookie options for HTTP-only cookies.
 */
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
  };
};

const clearAuthCookies = (response: Response) => {
  const cookieOptions = getCookieOptions();

  response.clearCookie('hockpay_at', {
    ...cookieOptions,
    path: '/',
  });

  response.clearCookie('hockpay_rt', {
    ...cookieOptions,
    path: '/api/v1/auth/refresh',
  });
};

/**
 * Controller for Authentication endpoints.
 *
 * This controller handles login, logout, and token refresh operations.
 * Business logic is delegated to the use cases from the core layer.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly switchStoreUseCase: SwitchStoreUseCase,
  ) {}

  /**
   * POST /auth/login
   *
   * Authenticates a merchant with email and password.
   * Sets access token and refresh token in HTTP-only cookies.
   */
  @Post('login')
  @Public()
  @Throttle({
    default: { limit: THROTTLE_LOGIN_LIMIT, ttl: THROTTLE_TTL_MS },
  })
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const dto = request.body as LoginRequestDto;
    const result = await this.loginUseCase.execute(dto);
    const cookieOptions = getCookieOptions();

    // Access token - available on all routes (15 min)
    response.cookie('hockpay_at', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    // Refresh token - restricted to refresh route only (7 days)
    // This increases security: the refresh token is only sent to /api/v1/auth/refresh
    response.cookie('hockpay_rt', result.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth/refresh',
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      merchant: result.merchant,
    };
  }

  /**
   * POST /auth/refresh
   *
   * Refreshes an access token using a refresh token from cookie.
   * Sets new access token and refresh token in HTTP-only cookies.
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshTokenResponseDto> {
    try {
      const refreshToken = request.cookies?.hockpay_rt;

      if (!refreshToken) {
        clearAuthCookies(response);
        throw new UnauthorizedException('Refresh token is required');
      }

      const result = await this.refreshTokenUseCase.execute({ refreshToken });
      const cookieOptions = getCookieOptions();

      response.cookie('hockpay_at', result.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      response.cookie('hockpay_rt', result.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth/refresh',
      });

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      };
    } catch (error) {
      if (
        error instanceof InvalidRefreshTokenError ||
        error instanceof RefreshTokenRevokedError ||
        error instanceof TokenExpiredError
      ) {
        clearAuthCookies(response);
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }

  /**
   * POST /auth/logout
   *
   * Logs out the current merchant by revoking their refresh token.
   * Clears both access token and refresh token cookies.
   */
  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    // Get refresh token from cookie only
    const refreshToken = request.cookies?.hockpay_rt;

    if (refreshToken) {
      await this.logoutUseCase.execute({ refreshToken });
    }

    clearAuthCookies(response);
  }

  /**
   * POST /auth/switch-store/:storeId
   *
   * Switches the current store context for the authenticated merchant.
   * Revokes old tokens and generates new tokens with the store context.
   * Sets new access token and refresh token in HTTP-only cookies.
   */
  @Post('switch-store/:storeId')
  @HttpCode(HttpStatus.OK)
  async switchStore(
    @Param('storeId') storeId: string,
    @CurrentUser() user: CurrentUserData,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ISwitchStoreOutput> {
    const result = await this.switchStoreUseCase.execute({
      merchantId: user.merchantId,
      storeId,
    });

    const cookieOptions = getCookieOptions();

    // Access token - available on all routes (15 min)
    response.cookie('hockpay_at', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    // Refresh token - restricted to refresh route only (7 days)
    response.cookie('hockpay_rt', result.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth/refresh',
    });

    return result;
  }
}
