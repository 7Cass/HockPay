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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CreateWithdrawalUseCase,
  GetWithdrawalUseCase,
  ListWithdrawalsUseCase,
} from '@hockpay/core';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { TransactionalIdempotencyService } from '../../common/idempotency/transactional-idempotency.service';
import {
  getIdempotencyRequestContext,
  readIdempotencyKeyHeader,
} from '../../common/idempotency/idempotency-request-context';
import { getRequestId } from '../../common/request-id';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { BankAccountResponseDto } from '../bank-account/dtos/bank-account-response.dto';
import { CreateWithdrawalDto } from './dtos/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dtos/list-withdrawals.dto';
import {
  CreateWithdrawalResponseDto,
  GetWithdrawalResponseDto,
  ListWithdrawalsResponseDto,
  WithdrawalResponseDto,
} from './dtos/withdrawal-response.dto';

@Controller('withdrawals')
@Public()
@UseGuards(CombinedAuthGuard)
export class WithdrawalController {
  constructor(
    private readonly createWithdrawalUseCase: CreateWithdrawalUseCase,
    private readonly listWithdrawalsUseCase: ListWithdrawalsUseCase,
    private readonly getWithdrawalUseCase: GetWithdrawalUseCase,
    private readonly idempotencyService: TransactionalIdempotencyService,
  ) {}

  @Post()
  @Idempotent({ required: true })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateWithdrawalDto,
    @CurrentStore() storeId: string,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<CreateWithdrawalResponseDto> {
    const input = {
      storeId,
      bankAccountId: dto.bankAccountId,
      amount: dto.amount,
      requestId: getRequestId(req),
    };
    const idempotencyKey = this.getIdempotencyKey(req);

    res?.setHeader('x-idempotency-key', idempotencyKey);
    res?.setHeader('x-idempotency-replayed', 'false');

    const result =
      await this.idempotencyService.execute<CreateWithdrawalResponseDto>({
        idempotencyKey,
        storeId,
        method: req?.method ?? 'POST',
        path: req?.path ?? '/withdrawals',
        body: dto,
        responseStatus: HttpStatus.CREATED,
        ttlSeconds: this.getIdempotencyTtlSeconds(req),
        operation: async (repos) => {
          const output =
            await this.createWithdrawalUseCase.executeInTransaction(
              input,
              repos,
            );

          return {
            withdrawal: WithdrawalResponseDto.fromObject(output.withdrawal),
          };
        },
      });

    res?.status(result.status);
    res?.setHeader('x-idempotency-replayed', String(result.replayed));
    res?.setHeader('x-idempotency-key', idempotencyKey);

    return result.body;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query() query: ListWithdrawalsQueryDto,
    @CurrentStore() storeId: string,
  ): Promise<ListWithdrawalsResponseDto> {
    const result = await this.listWithdrawalsUseCase.execute({
      storeId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      bankAccountId: query.bankAccountId,
      q: query.q,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return {
      ...result,
      withdrawals: result.withdrawals.map(WithdrawalResponseDto.fromObject),
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
  ): Promise<GetWithdrawalResponseDto> {
    const result = await this.getWithdrawalUseCase.execute({
      storeId,
      withdrawalId: id,
    });

    return {
      withdrawal: WithdrawalResponseDto.fromObject(result.withdrawal),
      bankAccount: result.bankAccount
        ? BankAccountResponseDto.fromObject(result.bankAccount as any)
        : null,
      transactions: result.transactions,
      timeline: result.timeline,
    };
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
}
