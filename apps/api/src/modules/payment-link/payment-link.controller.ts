import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
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
  PaymentLinkCannotBeCancelledError,
  PaymentLinkNotFoundError,
  PaymentLinkUnavailableError,
  StoreInactiveError,
  StoreNotApprovedError,
  StoreNotFoundError,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { getRequestId } from '../../common/request-id';
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
  ) {}

  @Post()
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePaymentLinkDto, @Req() req?: Request) {
    try {
      const storeId = (req as any)?.store?.id;
      if (!storeId) throw new Error('Store ID not found in request');

      return await this.createUseCase.execute({
        storeId,
        amount: dto.amount,
        title: dto.title,
        description: dto.description,
        internalReference: dto.internalReference,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  @Get()
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async list(@Query() query: ListPaymentLinksDto, @Req() req?: Request) {
    const storeId = (req as any)?.store?.id;
    if (!storeId) throw new Error('Store ID not found in request');

    return this.listUseCase.execute({
      storeId,
      page: query.page,
      limit: query.limit,
      status: query.status,
    });
  }

  @Get('public/:token')
  @HttpCode(HttpStatus.OK)
  async openPublic(@Param('token') token: string, @Req() req?: Request) {
    try {
      return await this.openUseCase.execute({
        publicToken: token,
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  @Post('public/:token/pay')
  @HttpCode(HttpStatus.OK)
  async payPublic(@Param('token') token: string, @Req() req?: Request) {
    try {
      return await this.payUseCase.execute({
        publicToken: token,
        requestId: getRequestId(req),
        environment: (req as any)?.environment ?? Environment.TEST,
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  @Post('public/:token/fail')
  @HttpCode(HttpStatus.OK)
  async failPublic(@Param('token') token: string, @Req() req?: Request) {
    try {
      return await this.failUseCase.execute({
        publicToken: token,
        requestId: getRequestId(req),
        environment: (req as any)?.environment ?? Environment.TEST,
        reason: 'Payment link simulated failure',
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  @Get(':id')
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async get(@Param('id') id: string, @Req() req?: Request) {
    try {
      const storeId = (req as any)?.store?.id;
      if (!storeId) throw new Error('Store ID not found in request');
      return await this.getUseCase.execute({ storeId, paymentLinkId: id });
    } catch (error) {
      this.mapError(error);
    }
  }

  @Post(':id/cancel')
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Req() req?: Request) {
    try {
      const storeId = (req as any)?.store?.id;
      if (!storeId) throw new Error('Store ID not found in request');
      await this.cancelUseCase.execute({
        storeId,
        paymentLinkId: id,
        requestId: getRequestId(req),
      });
      return await this.getUseCase.execute({ storeId, paymentLinkId: id });
    } catch (error) {
      this.mapError(error);
    }
  }

  private mapError(error: unknown): never {
    if (error instanceof PaymentLinkNotFoundError || error instanceof StoreNotFoundError) {
      throw new NotFoundException({ error: { code: (error as any).code, message: (error as Error).message } });
    }
    if (
      error instanceof StoreInactiveError ||
      error instanceof StoreNotApprovedError ||
      error instanceof PaymentLinkUnavailableError
    ) {
      throw new UnprocessableEntityException({ error: { code: (error as any).code, message: (error as Error).message } });
    }
    if (error instanceof PaymentLinkCannotBeCancelledError) {
      throw new ConflictException({ error: { code: error.code, message: error.message } });
    }
    throw error;
  }
}
