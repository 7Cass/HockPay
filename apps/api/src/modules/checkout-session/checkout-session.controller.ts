import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CreateCheckoutSessionDto } from './dtos/create-checkout-session.dto';
import { FulfillCheckoutSessionDto } from './dtos/fulfill-checkout-session.dto';
import {
  CreateCheckoutSessionUseCase,
  GetCheckoutSessionUseCase,
  FulfillCheckoutSessionUseCase,
  Environment,
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
import type { Request, Response } from 'express';
import { Res } from '@nestjs/common';
import { getRequestId } from '../../common/request-id';

@Controller('checkout-sessions')
@Public()
export class CheckoutSessionController {
  constructor(
    private readonly createUseCase: CreateCheckoutSessionUseCase,
    private readonly getUseCase: GetCheckoutSessionUseCase,
    private readonly fulfillUseCase: FulfillCheckoutSessionUseCase,
    private readonly idempotencyService: TransactionalIdempotencyService,
  ) {}

  @Post()
  @UseGuards(CombinedAuthGuard)
  @Idempotent({ required: true })
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Body() dto: CreateCheckoutSessionDto,
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
      description: dto.description,
      customerCollectionMode: dto.customerCollectionMode,
      prefillCustomer: dto.prefillCustomer,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      expiresInSeconds: dto.expiresInSeconds,
      metadata: dto.metadata,
    };
    const idempotencyKey =
      getIdempotencyRequestContext(req)?.key ??
      readIdempotencyKeyHeader(req) ??
      '';

    res?.setHeader('x-idempotency-key', idempotencyKey);
    const result = await this.idempotencyService.execute({
      idempotencyKey,
      storeId,
      environment,
      method: req?.method ?? 'POST',
      path: req?.path ?? '/checkout-sessions',
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

  @Get(':token')
  @HttpCode(HttpStatus.OK)
  async getSession(@Param('token') token: string) {
    return this.getUseCase.execute(token);
  }

  @Post(':token/fulfill')
  @HttpCode(HttpStatus.OK)
  async fulfillSession(
    @Param('token') token: string,
    @Body() dto: FulfillCheckoutSessionDto,
    @Req() req?: Request,
  ) {
    const environment = req?.environment ?? Environment.TEST;

    return this.fulfillUseCase.execute({
      token,
      requestId: getRequestId(req),
      customer: dto.customer,
      environment,
    });
  }
}
