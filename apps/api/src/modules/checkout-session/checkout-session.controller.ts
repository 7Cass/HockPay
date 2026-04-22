import { Controller, Post, Get, Body, Param, Req, HttpCode, HttpStatus, UseGuards, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CreateCheckoutSessionDto } from './dtos/create-checkout-session.dto';
import { FulfillCheckoutSessionDto } from './dtos/fulfill-checkout-session.dto';
import { CreateCheckoutSessionUseCase, GetCheckoutSessionUseCase, FulfillCheckoutSessionUseCase, StoreNotFoundError, StoreInactiveError, StoreNotApprovedError, CustomerIdentityConflictError, Environment } from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import type { Request } from 'express';

@Controller('checkout-sessions')
@Public()
export class CheckoutSessionController {
  constructor(
    private readonly createUseCase: CreateCheckoutSessionUseCase,
    private readonly getUseCase: GetCheckoutSessionUseCase,
    private readonly fulfillUseCase: FulfillCheckoutSessionUseCase,
  ) { }

  @Post()
  @UseGuards(CombinedAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createSession(@Body() dto: CreateCheckoutSessionDto, @Req() req?: Request) {
    try {
      const storeId = (req as any)?.store?.id;
      if (!storeId) throw new Error('Store ID not found in request');

      return await this.createUseCase.execute({
        storeId,
        amount: dto.amount,
        description: dto.description,
        customerCollectionMode: dto.customerCollectionMode,
        prefillCustomer: dto.prefillCustomer,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
        expiresInSeconds: dto.expiresInSeconds,
        metadata: dto.metadata,
      });
    } catch (e: any) {
      if (e instanceof StoreNotFoundError) throw new NotFoundException(e.message);
      if (e instanceof StoreInactiveError || e instanceof StoreNotApprovedError) throw new UnprocessableEntityException(e.message);
      throw e;
    }
  }

  @Get(':token')
  @HttpCode(HttpStatus.OK)
  async getSession(@Param('token') token: string) {
    try {
      return await this.getUseCase.execute(token);
    } catch (e: any) {
      throw new NotFoundException(e.message);
    }
  }

  @Post(':token/fulfill')
  @HttpCode(HttpStatus.OK)
  async fulfillSession(@Param('token') token: string, @Body() dto: FulfillCheckoutSessionDto, @Req() req?: Request) {
    try {
      // In a real scenario, you might derive environment from the session or a referer.
      // But for demo, Environment.TEST is a safe default. 
      // The Core FulfillCheckoutSessionUseCase relies on the environment for the sub-payment.
      const environment = (req as any)?.environment ?? Environment.TEST;

      return await this.fulfillUseCase.execute({
        token,
        customer: dto.customer,
        environment,
      });
    } catch (e: any) {
      if (e instanceof CustomerIdentityConflictError) {
        throw new UnprocessableEntityException(e.message);
      }
      throw new UnprocessableEntityException(e.message);
    }
  }
}
