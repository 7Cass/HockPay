import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  OperatorCreateRefundUseCase,
  OperatorCreateWithdrawalUseCase,
} from '@hockpay/core';
import { OperatorRoute } from './decorators/operator-route.decorator';
import {
  CurrentOperator,
  type CurrentOperatorData,
} from './decorators/current-operator.decorator';
import {
  OperatorCreateRefundDto,
  OperatorCreateWithdrawalDto,
} from './dtos/operator-store-money.dto';
import { TransactionalIdempotencyService } from '../../common/idempotency/transactional-idempotency.service';
import { readIdempotencyKeyHeader } from '../../common/idempotency/idempotency-request-context';
import { getRequestId } from '../../common/request-id';

/**
 * The desk moving money on behalf of a store.
 *
 * This is the other half of closing LIVE for a suspended store: the store stops
 * withdrawing and refunding on its own, and its balance is still its own, so
 * the way out is here. A locked door with no key would be worse than the door
 * into an empty room that slice 3 was careful to avoid.
 *
 * It lives apart from `OperatorStoreController` because it is a different kind
 * of power. That controller decides *about* a store -- LIVE status, commercial
 * condition -- and nothing it does touches the ledger. Everything here writes
 * to it, and pays the price that comes with that: an idempotency key is
 * mandatory, and every route leaves a trail line written in the same
 * transaction as the movement.
 *
 * The `@Idempotent()` decorator is deliberately not used. Its interceptor takes
 * the store from the merchant session the request does not have, and would
 * refuse every request here with `IDEMPOTENCY_STORE_REQUIRED`. The reservation
 * is made below instead, scoped to the store the desk is acting *for* -- which
 * is the correct scope anyway: two operators must not both withdraw for the
 * same store on the same key.
 */
@Controller('operator/stores')
@OperatorRoute()
export class OperatorStoreMoneyController {
  constructor(
    private readonly operatorCreateWithdrawalUseCase: OperatorCreateWithdrawalUseCase,
    private readonly operatorCreateRefundUseCase: OperatorCreateRefundUseCase,
    private readonly idempotencyService: TransactionalIdempotencyService,
  ) {}

  /**
   * POST /operator/stores/:id/withdrawals
   */
  @Post(':id/withdrawals')
  @HttpCode(HttpStatus.CREATED)
  async createWithdrawal(
    @Param('id') storeId: string,
    @Body() dto: OperatorCreateWithdrawalDto,
    @CurrentOperator() operator: CurrentOperatorData,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const idempotencyKey = this.requireIdempotencyKey(req);

    const result = await this.idempotencyService.execute({
      idempotencyKey,
      storeId,
      environment: dto.environment,
      method: req.method,
      path: req.path,
      body: dto,
      responseStatus: HttpStatus.CREATED,
      operation: (repos) =>
        this.operatorCreateWithdrawalUseCase.executeInTransaction(
          {
            operatorId: operator.operatorId,
            storeId,
            bankAccountId: dto.bankAccountId,
            amount: dto.amount,
            environment: dto.environment,
            reason: dto.reason,
            requestId: getRequestId(req),
          },
          repos,
        ),
    });

    this.markIdempotency(res, idempotencyKey, result);

    return result.body;
  }

  /**
   * POST /operator/stores/:id/refunds
   */
  @Post(':id/refunds')
  @HttpCode(HttpStatus.CREATED)
  async createRefund(
    @Param('id') storeId: string,
    @Body() dto: OperatorCreateRefundDto,
    @CurrentOperator() operator: CurrentOperatorData,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const idempotencyKey = this.requireIdempotencyKey(req);

    const result = await this.idempotencyService.execute({
      idempotencyKey,
      storeId,
      environment: dto.environment,
      method: req.method,
      path: req.path,
      body: dto,
      responseStatus: HttpStatus.CREATED,
      operation: (repos) =>
        this.operatorCreateRefundUseCase.executeInTransaction(
          {
            operatorId: operator.operatorId,
            storeId,
            paymentId: dto.paymentId,
            amount: dto.amount,
            environment: dto.environment,
            reason: dto.reason,
            requestId: getRequestId(req),
          },
          repos,
        ),
    });

    this.markIdempotency(res, idempotencyKey, result);

    return result.body;
  }

  /**
   * The header is required, and the check is here rather than in the shared
   * interceptor -- see the note on the class. The error code is the
   * interceptor's own, so a client sees one vocabulary across both surfaces.
   */
  private requireIdempotencyKey(req: Request): string {
    const key = readIdempotencyKeyHeader(req);

    if (!key) {
      throw new BadRequestException({
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'The Idempotency-Key header is required for this endpoint',
        },
      });
    }

    return key;
  }

  private markIdempotency(
    res: Response | undefined,
    idempotencyKey: string,
    result: { status: number; replayed: boolean },
  ): void {
    res?.status(result.status);
    res?.setHeader('x-idempotency-key', idempotencyKey);
    res?.setHeader('x-idempotency-replayed', String(result.replayed));
  }
}
