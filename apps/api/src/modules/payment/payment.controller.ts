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
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CreatePaymentUseCase,
  GetPaymentTimelineUseCase,
  GetPaymentUseCase,
  ListPaymentsUseCase,
  SimulateCheckoutPaymentUseCase,
  Environment,
} from '@hockpay/core';
import type { ICreatePaymentOutput } from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { CurrentEnvironment } from '../auth/decorators/current-environment.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { TransactionalIdempotencyService } from '../../common/idempotency/transactional-idempotency.service';
import {
  getIdempotencyRequestContext,
  readIdempotencyKeyHeader,
} from '../../common/idempotency/idempotency-request-context';
import { getRequestId } from '../../common/request-id';
import { CreatePaymentDto } from './dtos/create-payment.dto';
import {
  GetPaymentResponseDto,
  CreatePaymentResponseDto,
  GetPaymentTimelineResponseDto,
} from './dtos/payment-response.dto';
import {
  ListPaymentsQueryDto,
  ListPaymentsResponseDto,
} from './dtos/list-payments.dto';
import { SimulatePaymentDto } from './dtos/simulate-payment.dto';
import { mapWebhookLogToDto } from '../webhook/dtos/webhook-response.dto';

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
    private readonly getPaymentTimelineUseCase: GetPaymentTimelineUseCase,
    private readonly listPaymentsUseCase: ListPaymentsUseCase,
    private readonly simulatePaymentUseCase: SimulateCheckoutPaymentUseCase,
    private readonly idempotencyService: TransactionalIdempotencyService,
  ) {}

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
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<CreatePaymentResponseDto> {
    const input = {
      storeId,
      requestId: getRequestId(req),
      externalId: dto.externalId,
      amount: dto.amount,
      description: dto.description,
      customer: dto.customer,
      environment,
      paymentMethod: dto.paymentMethod,
      paymentDetails: dto.paymentDetails,
      acquirerId: dto.acquirerId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      metadata: dto.metadata,
    };
    const idempotencyKey = this.getIdempotencyKey(req);

    res?.setHeader('x-idempotency-key', idempotencyKey);
    res?.setHeader('x-idempotency-replayed', 'false');

    let createdPaymentOutput: ICreatePaymentOutput | undefined;

    const result =
      await this.idempotencyService.execute<CreatePaymentResponseDto>({
        idempotencyKey,
        storeId,
        method: req?.method ?? 'POST',
        path: req?.path ?? '/payments',
        body: dto,
        responseStatus: HttpStatus.CREATED,
        ttlSeconds: this.getIdempotencyTtlSeconds(req),
        operation: async (repos) => {
          const output = await this.createPaymentUseCase.executeInTransaction(
            input,
            repos,
          );
          createdPaymentOutput = output;

          return {
            payment: output.payment,
            customerCreated: output.customerCreated,
          };
        },
      });

    res?.status(result.status);
    res?.setHeader('x-idempotency-replayed', String(result.replayed));
    res?.setHeader('x-idempotency-key', idempotencyKey);

    if (!result.replayed && createdPaymentOutput) {
      await this.createPaymentUseCase.scheduleExpirationAfterCommit(
        input,
        createdPaymentOutput,
      );
    }

    return result.body;
  }

  private getIdempotencyKey(req?: Request): string {
    return (
      getIdempotencyRequestContext(req)?.key ??
      readIdempotencyKeyHeader(req) ??
      ''
    );
  }

  private getIdempotencyTtlSeconds(req?: Request): number | undefined {
    return getIdempotencyRequestContext(req)?.ttlSeconds;
  }

  /**
   * GET /api/v1/payments/:id/timeline
   *
   * Gets a payment and its related operational timeline.
   */
  @Get(':id/timeline')
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPaymentTimeline(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ): Promise<GetPaymentTimelineResponseDto> {
    const result = await this.getPaymentTimelineUseCase.execute({
      storeId,
      paymentId: id,
      environment,
    });

    return {
      ...result,
      webhookLogs: result.webhookLogs.map((log) => mapWebhookLogToDto(log)),
    };
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
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
  ): Promise<GetPaymentResponseDto> {
    const result = await this.getPaymentUseCase.execute({
      storeId,
      paymentId: id,
      requestId: getRequestId(req),
      environment,
    });

    return {
      payment: result.payment,
    };
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
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ): Promise<ListPaymentsResponseDto> {
    return this.listPaymentsUseCase.execute({
      storeId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      customerId: query.customerId,
      externalId: query.externalId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      environment,
    });
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
    @Body() dto: SimulatePaymentDto,
    @Req() req?: Request,
  ) {
    const result = await this.simulatePaymentUseCase.execute({
      paymentId: id,
      checkoutToken: dto.checkoutToken,
      action,
      requestId: getRequestId(req),
    });

    return {
      payment: result.payment,
    };
  }
}
