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
import type { Request } from 'express';
import {
  CreateWithdrawalUseCase,
  GetWithdrawalUseCase,
  ListWithdrawalsUseCase,
} from '@hockpay/core';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { getRequestId } from '../../common/request-id';
import { Public } from '../auth/decorators/public.decorator';
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
  ) {}

  @Post()
  @Idempotent({ required: true })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateWithdrawalDto,
    @Req() req?: Request,
  ): Promise<CreateWithdrawalResponseDto> {
    const result = await this.createWithdrawalUseCase.execute({
      storeId: this.getStoreId(req),
      bankAccountId: dto.bankAccountId,
      amount: dto.amount,
      requestId: getRequestId(req),
    });

    return {
      withdrawal: WithdrawalResponseDto.fromObject(result.withdrawal),
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query() query: ListWithdrawalsQueryDto,
    @Req() req?: Request,
  ): Promise<ListWithdrawalsResponseDto> {
    const result = await this.listWithdrawalsUseCase.execute({
      storeId: this.getStoreId(req),
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
    @Req() req?: Request,
  ): Promise<GetWithdrawalResponseDto> {
    const result = await this.getWithdrawalUseCase.execute({
      storeId: this.getStoreId(req),
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

  private getStoreId(req?: Request): string {
    const storeId = (req as any)?.store?.id ?? (req as any)?.user?.storeId;
    if (!storeId) {
      throw new Error('Store ID not found in request');
    }
    return storeId;
  }
}
