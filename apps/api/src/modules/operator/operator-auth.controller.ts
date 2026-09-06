import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  OperatorLoginUseCase,
  OperatorLogoutUseCase,
  OperatorRefreshTokenUseCase,
} from '@hockpay/core';
import {
  OperatorLoginRequestDto,
  OperatorLoginResponseDto,
  OperatorRefreshResponseDto,
} from './dtos/operator-auth.dto';
import {
  OPERATOR_ACCESS_COOKIE,
  OPERATOR_REFRESH_COOKIE,
} from './guards/operator-auth.guard';
import { OperatorRoute } from './decorators/operator-route.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { getOrCreateRequestId } from '../../common/request-id';
import {
  THROTTLE_LOGIN_LIMIT,
  THROTTLE_TTL_MS,
} from '../../common/throttle-config';

const ACCESS_COOKIE_PATH = '/api/v1/operator';
const REFRESH_COOKIE_PATH = '/api/v1/operator/auth/refresh';
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
});

const clearOperatorCookies = (response: Response) => {
  const cookieOptions = getCookieOptions();

  response.clearCookie(OPERATOR_ACCESS_COOKIE, {
    ...cookieOptions,
    path: ACCESS_COOKIE_PATH,
  });
  response.clearCookie(OPERATOR_REFRESH_COOKIE, {
    ...cookieOptions,
    path: REFRESH_COOKIE_PATH,
  });
};

const setOperatorCookies = (
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
) => {
  const cookieOptions = getCookieOptions();

  response.cookie(OPERATOR_ACCESS_COOKIE, tokens.accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_COOKIE_MAX_AGE,
    path: ACCESS_COOKIE_PATH,
  });
  response.cookie(OPERATOR_REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: REFRESH_COOKIE_PATH,
  });
};

/**
 * Operator authentication.
 *
 * Cookies, paths and secret are the operator's own. A merchant session never
 * grants one of these, and there is no elevation path between the two.
 */
@Controller('operator/auth')
@OperatorRoute()
export class OperatorAuthController {
  constructor(
    private readonly operatorLoginUseCase: OperatorLoginUseCase,
    private readonly operatorRefreshTokenUseCase: OperatorRefreshTokenUseCase,
    private readonly operatorLogoutUseCase: OperatorLogoutUseCase,
  ) {}

  /**
   * POST /operator/auth/login
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
  ): Promise<OperatorLoginResponseDto> {
    const dto = request.body as OperatorLoginRequestDto;
    const result = await this.operatorLoginUseCase.execute({
      email: dto?.email,
      password: dto?.password,
      requestId: getOrCreateRequestId(request),
    });

    setOperatorCookies(response, result);

    return {
      expiresIn: result.expiresIn,
      operator: result.operator,
    };
  }

  /**
   * POST /operator/auth/refresh
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OperatorRefreshResponseDto> {
    const refreshToken = request.cookies?.[OPERATOR_REFRESH_COOKIE];

    if (!refreshToken) {
      clearOperatorCookies(response);
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      const result = await this.operatorRefreshTokenUseCase.execute({
        refreshToken,
      });

      setOperatorCookies(response, result);

      return { expiresIn: result.expiresIn };
    } catch (error) {
      clearOperatorCookies(response);
      throw error;
    }
  }

  /**
   * POST /operator/auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = request.cookies?.[OPERATOR_REFRESH_COOKIE];

    if (refreshToken) {
      await this.operatorLogoutUseCase.execute({
        refreshToken,
        requestId: getOrCreateRequestId(request),
      });
    }

    clearOperatorCookies(response);
  }
}
