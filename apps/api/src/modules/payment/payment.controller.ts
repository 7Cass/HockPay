import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  CreatePaymentUseCase,
  GetPaymentUseCase,
  ListPaymentsUseCase,
  SimulateCheckoutPaymentUseCase,
  ExternalIdAlreadyExistsError,
  PaymentNotFoundError,
  StoreNotFoundError,
  StoreInactiveError,
  StoreNotApprovedError,
  Environment,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { CreatePaymentDto } from './dtos/create-payment.dto';
import {
  GetPaymentResponseDto,
  CreatePaymentResponseDto,
} from './dtos/payment-response.dto';
import {
  ListPaymentsQueryDto,
  ListPaymentsResponseDto,
} from './dtos/list-payments.dto';

/**
 * Controller for Payment endpoints.
 *
 * This controller handles payment CRUD operations.
 * Business logic is delegated to the use cases from the core layer.
 *
 * Authentication:
 * - All routes use CombinedAuthGuard (API Key OR JWT Cookie)
 * - @Public() bypasses the global JWT guard, CombinedAuthGuard handles auth
 */
@Controller('payments')
@Public()
export class PaymentController {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    private readonly getPaymentUseCase: GetPaymentUseCase,
    private readonly listPaymentsUseCase: ListPaymentsUseCase,
    private readonly simulatePaymentUseCase: SimulateCheckoutPaymentUseCase,
  ) { }

  /**
   * POST /api/v1/payments
   *
   * Creates a new payment with customer on-the-fly creation.
   * Supports idempotency via Idempotency-Key header.
   */
  @Post()
  @Idempotent({ required: true })
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @Req() req?: Request,
  ): Promise<CreatePaymentResponseDto> {
    try {
      const storeId = (req as any)?.store?.id;
      const environment = (req as any)?.environment ?? Environment.TEST;

      if (!storeId) {
        throw new Error('Store ID not found in request');
      }

      const result = await this.createPaymentUseCase.execute({
        storeId,
        externalId: dto.externalId,
        amount: dto.amount,
        description: dto.description,
        customer: dto.customer,
        environment,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        metadata: dto.metadata,
      });

      return {
        payment: result.payment,
        customerCreated: result.customerCreated,
      };
    } catch (error) {
      if (error instanceof ExternalIdAlreadyExistsError) {
        throw new ConflictException({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      if (error instanceof StoreNotFoundError) {
        throw new NotFoundException({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      if (error instanceof StoreInactiveError) {
        throw new UnprocessableEntityException({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      if (error instanceof StoreNotApprovedError) {
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

  /**
   * GET /api/v1/payments/:id
   *
   * Gets a payment by ID with lazy expiration check.
   */
  @Get(':id')
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPayment(
    @Param('id') id: string,
    @Req() req?: Request,
  ): Promise<GetPaymentResponseDto> {
    try {
      const storeId = (req as any)?.store?.id;

      if (!storeId) {
        throw new Error('Store ID not found in request');
      }

      const result = await this.getPaymentUseCase.execute({
        storeId,
        paymentId: id,
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
      throw error;
    }
  }

  /**
   * GET /api/v1/payments
   *
   * Lists payments with pagination and filters.
   */
  @Get()
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async listPayments(
    @Query() query: ListPaymentsQueryDto,
    @Req() req?: Request,
  ): Promise<ListPaymentsResponseDto> {
    const storeId = (req as any)?.store?.id;

    if (!storeId) {
      throw new Error('Store ID not found in request');
    }

    const result = await this.listPaymentsUseCase.execute({
      storeId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      customerId: query.customerId,
      externalId: query.externalId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return result;
  }

  /**
   * POST /api/v1/payments/:id/simulate/:action
   * 
   * Simulates a payment action for TEST environment payments.
   * Publicly accessible for the checkout dev UI.
   */
  @Post(':id/simulate/:action')
  @Public()
  @HttpCode(HttpStatus.OK)
  async simulatePayment(
    @Param('id') id: string,
    @Param('action') action: 'confirm' | 'expire' | 'fail',
  ) {
    try {
      const result = await this.simulatePaymentUseCase.execute({
        paymentId: id,
        action,
      });

      return {
        payment: result.payment,
      };
    } catch (error: any) {
       // Only test payments can be simulated, LiveEnvironmentNotAllowedError can be thrown
       if (error.name === 'PaymentNotFoundError') throw new NotFoundException(error.message);
       throw new UnprocessableEntityException(error.message);
    }
  }
}
