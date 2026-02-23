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
import type { Request } from 'express';
import {
  CreatePaymentUseCase,
  GetPaymentUseCase,
  ListPaymentsUseCase,
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
@UseGuards(CombinedAuthGuard)
export class PaymentController {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    private readonly getPaymentUseCase: GetPaymentUseCase,
    private readonly listPaymentsUseCase: ListPaymentsUseCase,
  ) {}

  /**
   * POST /v1/payments
   *
   * Creates a new payment with customer on-the-fly creation.
   * Supports idempotency via Idempotency-Key header.
   */
  @Post()
  @Idempotent({ required: true })
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
   * GET /v1/payments/:id
   *
   * Gets a payment by ID with lazy expiration check.
   */
  @Get(':id')
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
   * GET /v1/payments
   *
   * Lists payments with pagination and filters.
   */
  @Get()
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
}
