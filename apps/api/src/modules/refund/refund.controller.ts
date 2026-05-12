import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateRefundUseCase,
  PaymentNotFoundError,
  InvalidRefundAmountError,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { getRequestId } from '../../common/request-id';
import { CreateRefundDto } from './dtos/create-refund.dto';
import {
  CreateRefundResponseDto,
  RefundResponseDto,
} from './dtos/refund-response.dto';

@Controller('refunds')
@Public()
@UseGuards(CombinedAuthGuard)
export class RefundController {
  constructor(private readonly createRefundUseCase: CreateRefundUseCase) {}

  @Post()
  @Idempotent({ required: true })
  @HttpCode(HttpStatus.CREATED)
  async createRefund(
    @Body() dto: CreateRefundDto,
    @Req() req: Request,
  ): Promise<CreateRefundResponseDto> {
    const storeId = (req as any)?.store?.id;

    if (!storeId) {
      throw new Error('Store ID not found in request');
    }

    try {
      const result = await this.createRefundUseCase.execute({
        storeId,
        paymentId: dto.paymentId,
        requestId: getRequestId(req),
        amount: dto.amount,
        reason: dto.reason,
      });

      return {
        refund: this.toRefundResponse(result.refund),
        payment: result.payment,
      };
    } catch (error) {
      if (error instanceof PaymentNotFoundError) {
        throw new UnprocessableEntityException({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      if (error instanceof InvalidRefundAmountError) {
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

  private toRefundResponse(refund: any): RefundResponseDto {
    return {
      id: refund.id,
      paymentId: refund.paymentId,
      amount: refund.amount,
      feeRefunded: refund.feeRefunded,
      reason: refund.reason,
      status: refund.status,
      processedAt: refund.processedAt,
      createdAt: refund.createdAt,
    };
  }
}
