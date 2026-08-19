import {
  Controller,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ConfirmPaymentUseCase,
  ExpirePaymentUseCase,
  FailPaymentUseCase,
  LiveEnvironmentNotAllowedError,
  ReleasePaymentUseCase,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { CurrentEnvironment } from '../auth/decorators/current-environment.decorator';
import { GetPaymentResponseDto } from './dtos/payment-response.dto';
import { Environment } from '@hockpay/core';
import { getRequestId } from '../../common/request-id';

/**
 * Controller for Dev/Simulation endpoints.
 *
 * These endpoints allow simulating payment status changes in test environment.
 * Only works with API keys from TEST environment.
 *
 * Authentication:
 * - All routes use CombinedAuthGuard (API Key OR JWT Cookie)
 * - @Public() bypasses the global JWT guard, CombinedAuthGuard handles auth
 * - Must be using a TEST environment API key
 */
@Controller('dev/simulate')
@Public()
@UseGuards(CombinedAuthGuard)
export class DevController {
  constructor(
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
    private readonly expirePaymentUseCase: ExpirePaymentUseCase,
    private readonly failPaymentUseCase: FailPaymentUseCase,
    private readonly releasePaymentUseCase: ReleasePaymentUseCase,
  ) {}

  /**
   * POST /api/v1/dev/simulate/:id/confirm
   *
   * Simulates a payment confirmation (as if customer paid the Pix).
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPayment(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
  ): Promise<GetPaymentResponseDto> {
    this.validateTestEnvironment(environment);

    const result = await this.confirmPaymentUseCase.execute({
      storeId,
      paymentId: id,
      requestId: getRequestId(req),
    });

    return {
      payment: result.payment,
    };
  }

  /**
   * POST /api/v1/dev/simulate/:id/expire
   *
   * Simulates a payment expiration.
   */
  @Post(':id/expire')
  @HttpCode(HttpStatus.OK)
  async expirePayment(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
  ): Promise<GetPaymentResponseDto> {
    this.validateTestEnvironment(environment);

    const result = await this.expirePaymentUseCase.execute({
      storeId,
      paymentId: id,
      requestId: getRequestId(req),
      strictPending: true,
    });

    return {
      payment: result.payment,
    };
  }

  /**
   * POST /api/v1/dev/simulate/:id/fail
   *
   * Simulates a payment failure.
   * Optional reason query parameter: ?reason=insufficient_funds
   */
  @Post(':id/fail')
  @HttpCode(HttpStatus.OK)
  async failPayment(
    @Param('id') id: string,
    @Query('reason') reason?: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
  ): Promise<GetPaymentResponseDto> {
    this.validateTestEnvironment(environment);

    const result = await this.failPaymentUseCase.execute({
      storeId,
      paymentId: id,
      requestId: getRequestId(req),
      reason: reason ?? 'Payment failed (simulated)',
    });

    return {
      payment: result.payment,
    };
  }

  /**
   * POST /api/v1/dev/simulate/:id/release
   *
   * Simulates settlement release from pending balance to available balance.
   */
  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  async releasePayment(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
  ): Promise<GetPaymentResponseDto> {
    this.validateTestEnvironment(environment);

    const result = await this.releasePaymentUseCase.execute({
      storeId,
      paymentId: id,
      requestId: getRequestId(req),
    });

    return {
      payment: result.payment,
    };
  }

  private validateTestEnvironment(environment: Environment): void {
    if (environment === Environment.LIVE) {
      throw new LiveEnvironmentNotAllowedError();
    }
  }
}
