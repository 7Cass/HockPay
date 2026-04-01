import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  LoginUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
  SwitchStoreUseCase,
  ISwitchStoreOutput,
} from '@hockpay/core';
import {
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
} from './dtos/login.dto';
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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
    // Get refresh token from cookie only (required)
    const refreshToken = request.cookies?.hockpay_rt;

    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    const result = await this.refreshTokenUseCase.execute({ refreshToken });
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

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
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

    const cookieOptions = getCookieOptions();

    // Clear access token cookie
    response.clearCookie('hockpay_at', {
      ...cookieOptions,
      path: '/',
    });

    // Clear refresh token cookie
    response.clearCookie('hockpay_rt', {
      ...cookieOptions,
      path: '/api/v1/auth/refresh',
    });
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
