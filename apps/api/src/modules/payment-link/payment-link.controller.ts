import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  CancelPaymentLinkUseCase,
  CreatePaymentLinkUseCase,
  Environment,
  GetPaymentLinkUseCase,
  ListPaymentLinksUseCase,
  OpenPaymentLinkUseCase,
  PayPaymentLinkUseCase,
  FailPaymentLinkUseCase,
  LiveEnvironmentNotAllowedError,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { CurrentEnvironment } from '../auth/decorators/current-environment.decorator';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { TransactionalIdempotencyService } from '../../common/idempotency/transactional-idempotency.service';
import {
  getIdempotencyRequestContext,
  readIdempotencyKeyHeader,
} from '../../common/idempotency/idempotency-request-context';
import { getRequestId } from '../../common/request-id';
import type { Response } from 'express';
import { Res } from '@nestjs/common';
import { CreatePaymentLinkDto } from './dtos/create-payment-link.dto';
import { ListPaymentLinksDto } from './dtos/list-payment-links.dto';

@Controller('payment-links')
@Public()
export class PaymentLinkController {
  constructor(
    private readonly createUseCase: CreatePaymentLinkUseCase,
    private readonly listUseCase: ListPaymentLinksUseCase,
    private readonly getUseCase: GetPaymentLinkUseCase,
    private readonly cancelUseCase: CancelPaymentLinkUseCase,
    private readonly openUseCase: OpenPaymentLinkUseCase,
    private readonly payUseCase: PayPaymentLinkUseCase,
    private readonly failUseCase: FailPaymentLinkUseCase,
    private readonly idempotencyService: TransactionalIdempotencyService,
  ) {}

  @Post()
  @UseGuards(CombinedAuthGuard)
  @Idempotent({ required: true })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePaymentLinkDto,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const input = {
      storeId,
      environment,
      amount: dto.amount,
      items: dto.items,
      title: dto.title,
      description: dto.description,
      internalReference: dto.internalReference,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    };
    const idempotencyKey =
      getIdempotencyRequestContext(req)?.key ??
      readIdempotencyKeyHeader(req) ??
      '';

    res?.setHeader('x-idempotency-key', idempotencyKey);
    const result = await this.idempotencyService.execute({
      idempotencyKey,
      storeId,
      method: req?.method ?? 'POST',
      path: req?.path ?? '/payment-links',
      body: dto,
      responseStatus: HttpStatus.CREATED,
      ttlSeconds: getIdempotencyRequestContext(req)?.ttlSeconds,
      operation: (repos) =>
        this.createUseCase.executeInTransaction(input, repos),
    });

    res?.status(result.status);
    res?.setHeader('x-idempotency-replayed', String(result.replayed));
    return result.body;
  }

  @Get()
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async list(
    @Query() query: ListPaymentLinksDto,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.listUseCase.execute({
      storeId,
      environment,
      page: query.page,
      limit: query.limit,
      status: query.status,
      hasFailures: query.hasFailures,
    });
  }

  @Get('public/:token')
  @HttpCode(HttpStatus.OK)
  async openPublic(@Param('token') token: string) {
    return this.openUseCase.execute({
      publicToken: token,
    });
  }

  @Post('public/:token/pay')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async payPublic(
    @Param('token') token: string,
    @Body()
    body: { customer?: { document?: string; name?: string; email?: string } },
    @Req() req?: Request,
  ) {
    return this.payUseCase.execute({
      publicToken: token,
      requestId: getRequestId(req),
      environment: req?.environment ?? Environment.TEST,
      customer: body?.customer,
    });
  }

  @Post('public/:token/fail')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async failPublic(@Param('token') token: string, @Req() req?: Request) {
    return this.failUseCase.execute({
      publicToken: token,
      requestId: getRequestId(req),
      environment: req?.environment ?? Environment.TEST,
      reason: 'Payment link simulated failure',
    });
  }

  @Get(':id')
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async get(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.getUseCase.execute({
      storeId,
      paymentLinkId: id,
      environment,
    });
  }

  @Post(':id/cancel')
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
  ) {
    await this.cancelUseCase.execute({
      storeId,
      paymentLinkId: id,
      requestId: getRequestId(req),
    });
    return this.getUseCase.execute({ storeId, paymentLinkId: id, environment });
  }

  @Post(':id/pay')
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async payAuthenticated(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
  ) {
    this.validateTestEnvironment(environment);
    const { paymentLink } = await this.getUseCase.execute({
      storeId,
      paymentLinkId: id,
      environment,
    });

    return this.payUseCase.execute({
      publicToken: paymentLink.publicToken,
      requestId: getRequestId(req),
      environment: Environment.TEST,
    });
  }

  @Post(':id/fail')
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async failAuthenticated(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Body('reason') reason?: string,
    @Req() req?: Request,
  ) {
    this.validateTestEnvironment(environment);
    const { paymentLink } = await this.getUseCase.execute({
      storeId,
      paymentLinkId: id,
      environment,
    });

    return this.failUseCase.execute({
      publicToken: paymentLink.publicToken,
      requestId: getRequestId(req),
      environment: Environment.TEST,
      reason: reason ?? 'Payment link simulated failure',
    });
  }

  private validateTestEnvironment(environment: Environment): void {
    if (environment === Environment.LIVE) {
      throw new LiveEnvironmentNotAllowedError();
    }
  }
}
