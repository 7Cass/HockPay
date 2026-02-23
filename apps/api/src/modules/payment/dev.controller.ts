import {
  Controller,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ConfirmPaymentUseCase,
  ExpirePaymentUseCase,
  FailPaymentUseCase,
  PaymentNotFoundError,
  PaymentExpiredError,
  InvalidPaymentStatusError,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { GetPaymentResponseDto } from './dtos/payment-response.dto';
import { Environment } from '@hockpay/core';

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
  ) {}

  /**
   * POST /v1/dev/simulate/:id/confirm
   *
   * Simulates a payment confirmation (as if customer paid the Pix).
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPayment(
    @Param('id') id: string,
    @Req() req?: Request,
  ): Promise<GetPaymentResponseDto> {
    this.validateTestEnvironment(req);

    try {
      const storeId = (req as any)?.store?.id;

      if (!storeId) {
        throw new Error('Store ID not found in request');
      }

      const result = await this.confirmPaymentUseCase.execute({
        storeId,
        paymentId: id,
      });

      return {
        payment: result.payment,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * POST /v1/dev/simulate/:id/expire
   *
   * Simulates a payment expiration.
   */
  @Post(':id/expire')
  @HttpCode(HttpStatus.OK)
  async expirePayment(
    @Param('id') id: string,
    @Req() req?: Request,
  ): Promise<GetPaymentResponseDto> {
    this.validateTestEnvironment(req);

    try {
      const result = await this.expirePaymentUseCase.execute({
        paymentId: id,
      });

      return {
        payment: result.payment,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * POST /v1/dev/simulate/:id/fail
   *
   * Simulates a payment failure.
   * Optional reason query parameter: ?reason=insufficient_funds
   */
  @Post(':id/fail')
  @HttpCode(HttpStatus.OK)
  async failPayment(
    @Param('id') id: string,
    @Query('reason') reason?: string,
    @Req() req?: Request,
  ): Promise<GetPaymentResponseDto> {
    this.validateTestEnvironment(req);

    try {
      const storeId = (req as any)?.store?.id;

      if (!storeId) {
        throw new Error('Store ID not found in request');
      }

      const result = await this.failPaymentUseCase.execute({
        storeId,
        paymentId: id,
        reason: reason ?? 'Payment failed (simulated)',
      });

      return {
        payment: result.payment,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Validates that the request is from a TEST environment.
   * Throws BadRequestException if in LIVE environment.
   */
  private validateTestEnvironment(req?: Request): void {
    const environment = (req as any)?.environment as Environment | undefined;

    if (environment === Environment.LIVE) {
      throw new BadRequestException({
        error: {
          code: 'LIVE_ENVIRONMENT_NOT_ALLOWED',
          message:
            'Dev simulation endpoints are not available in LIVE environment',
        },
      });
    }
  }

  /**
   * Handle common errors from use cases.
   */
  private handleError(error: unknown): never {
    if (error instanceof PaymentNotFoundError) {
      throw new NotFoundException({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    if (error instanceof PaymentExpiredError) {
      throw new UnprocessableEntityException({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    if (error instanceof InvalidPaymentStatusError) {
      throw new UnprocessableEntityException({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    throw error;
  }
}
