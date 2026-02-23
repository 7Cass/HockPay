import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  GetCheckoutPaymentUseCase,
  SimulateCheckoutPaymentUseCase,
  PaymentNotFoundError,
  LiveEnvironmentNotAllowedError,
  InvalidPaymentStatusError,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Controller for public Checkout endpoints.
 *
 * This controller provides public access to payment checkout data.
 * No authentication is required - access is controlled via checkout token.
 */
@Controller('checkout')
@Public()
export class CheckoutController {
  constructor(
    private readonly getCheckoutPaymentUseCase: GetCheckoutPaymentUseCase,
    private readonly simulateCheckoutPaymentUseCase: SimulateCheckoutPaymentUseCase,
  ) {}

  /**
   * GET /v1/checkout/:token
   *
   * Gets payment data for the checkout page by token.
   * This is a public endpoint - no authentication required.
   * The token is a unique, hard-to-guess identifier.
   */
  @Get(':token')
  @HttpCode(HttpStatus.OK)
  async getCheckoutPayment(@Param('token') token: string) {
    const result = await this.getCheckoutPaymentUseCase.execute({ token });

    if (!result) {
      throw new NotFoundException({
        error: {
          code: 'CHECKOUT_NOT_FOUND',
          message: 'Checkout not found or expired',
        },
      });
    }

    return result;
  }

  /**
   * POST /v1/checkout/:token/simulate/confirm
   *
   * Simulates confirming a payment via checkout token.
   * Only works for TEST environment payments.
   */
  @Post(':token/simulate/confirm')
  @HttpCode(HttpStatus.OK)
  async simulateConfirm(@Param('token') token: string) {
    return this.simulatePayment(token, 'confirm');
  }

  /**
   * POST /v1/checkout/:token/simulate/expire
   *
   * Simulates expiring a payment via checkout token.
   * Only works for TEST environment payments.
   */
  @Post(':token/simulate/expire')
  @HttpCode(HttpStatus.OK)
  async simulateExpire(@Param('token') token: string) {
    return this.simulatePayment(token, 'expire');
  }

  /**
   * POST /v1/checkout/:token/simulate/fail
   *
   * Simulates failing a payment via checkout token.
   * Only works for TEST environment payments.
   */
  @Post(':token/simulate/fail')
  @HttpCode(HttpStatus.OK)
  async simulateFail(@Param('token') token: string) {
    return this.simulatePayment(token, 'fail');
  }

  /**
   * Helper method to simulate payment actions.
   */
  private async simulatePayment(token: string, action: 'confirm' | 'expire' | 'fail') {
    try {
      const result = await this.simulateCheckoutPaymentUseCase.execute({
        token,
        action,
      });

      return {
        payment: result.payment,
      };
    } catch (error) {
      if (error instanceof PaymentNotFoundError) {
        throw new NotFoundException({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      if (error instanceof LiveEnvironmentNotAllowedError) {
        throw new ForbiddenException({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      if (error instanceof InvalidPaymentStatusError) {
        throw new BadRequestException({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      throw error;
    }
  }
}
