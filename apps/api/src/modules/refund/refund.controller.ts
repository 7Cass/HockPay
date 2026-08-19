import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CreateRefundUseCase, Environment } from '@hockpay/core';
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
import { CreateRefundDto } from './dtos/create-refund.dto';
import {
  CreateRefundResponseDto,
  RefundResponseDto,
} from './dtos/refund-response.dto';

@Controller('refunds')
@Public()
@UseGuards(CombinedAuthGuard)
export class RefundController {
  constructor(
    private readonly createRefundUseCase: CreateRefundUseCase,
    private readonly idempotencyService: TransactionalIdempotencyService,
  ) {}

  @Post()
  @Idempotent({ required: true })
  @HttpCode(HttpStatus.CREATED)
  async createRefund(
    @Body() dto: CreateRefundDto,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() callerEnvironment: Environment,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<CreateRefundResponseDto> {
    const input = {
      storeId,
      paymentId: dto.paymentId,
      requestId: getRequestId(req),
      amount: dto.amount,
      reason: dto.reason,
      callerEnvironment,
    };
    const idempotencyKey = this.getIdempotencyKey(req);

    res?.setHeader('x-idempotency-key', idempotencyKey);
    res?.setHeader('x-idempotency-replayed', 'false');

    const result =
      await this.idempotencyService.execute<CreateRefundResponseDto>({
        idempotencyKey,
        storeId,
        method: req.method,
        path: req.path,
        body: dto,
        responseStatus: HttpStatus.CREATED,
        ttlSeconds: this.getIdempotencyTtlSeconds(req),
        operation: async (repos) => {
          const output = await this.createRefundUseCase.executeInTransaction(
            input,
            repos,
          );

          return {
            refund: this.toRefundResponse(output.refund),
            payment: output.payment,
          };
        },
      });

    res?.status(result.status);
    res?.setHeader('x-idempotency-replayed', String(result.replayed));
    res?.setHeader('x-idempotency-key', idempotencyKey);

    return result.body;
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

  private getIdempotencyKey(req: Request): string {
    return (
      getIdempotencyRequestContext(req)?.key ??
      readIdempotencyKeyHeader(req) ??
      ''
    );
  }

  private getIdempotencyTtlSeconds(req: Request): number | undefined {
    return getIdempotencyRequestContext(req)?.ttlSeconds;
  }
}
