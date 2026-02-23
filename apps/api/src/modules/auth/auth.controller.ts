import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  LoginUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
  LogoutAllUseCase,
} from '@hockpay/core';
import {
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenRequestDto,
  RefreshTokenResponseDto,
  LogoutRequestDto,
} from './dtos/login.dto';

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
    private readonly logoutAllUseCase: LogoutAllUseCase,
  ) {}

  /**
   * POST /auth/login
   *
   * Authenticates a merchant with email and password.
   * Returns access token and sets refresh token in HTTP-only cookie.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.loginUseCase.execute(dto);

    // Set refresh token as HTTP-only cookie
    response.cookie('hockpay_rt', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
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
   * Refreshes an access token using a refresh token.
   * The refresh token can be provided in the request body or cookie.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() dto: RefreshTokenRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshTokenResponseDto> {
    // Get refresh token from body or cookie
    const refreshToken =
      dto.refreshToken || request.cookies?.hockpay_rt;

    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    const result = await this.refreshTokenUseCase.execute({ refreshToken });

    // Set new refresh token as HTTP-only cookie
    response.cookie('hockpay_rt', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
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
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: LogoutRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    // Get refresh token from body or cookie
    const refreshToken =
      dto.refreshToken || request.cookies?.hockpay_rt;

    if (refreshToken) {
      await this.logoutUseCase.execute({ refreshToken });
    }

    // Clear the refresh token cookie
    response.clearCookie('hockpay_rt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  /**
   * POST /auth/logout-all
   *
   * Logs out the merchant from all devices by revoking all refresh tokens.
   * Requires authentication.
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    // The merchant ID should be extracted from the JWT token via a guard
    const merchantId = (request as any).user?.sub;

    if (!merchantId) {
      throw new Error('Merchant not authenticated');
    }

    await this.logoutAllUseCase.execute({ merchantId });

    // Clear the refresh token cookie
    response.clearCookie('hockpay_rt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }
}
