import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CompleteWithdrawalUseCase,
  Environment,
  FailWithdrawalUseCase,
} from '@hockpay/core';
import { getRequestId } from '../../common/request-id';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { CurrentEnvironment } from '../auth/decorators/current-environment.decorator';
import {
  GetWithdrawalResponseDto,
  WithdrawalResponseDto,
} from './dtos/withdrawal-response.dto';

class FailWithdrawalDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

/**
 * Acoes de simulacao de saque.
 *
 * Elas nao recusam mais LIVE na porta. Simular em LIVE segue a mesma regra de
 * cobrar em LIVE -- a mesa precisa ter a loja habilitada -- e quem responde e o
 * use case, com `STORE_LIVE_NOT_ENABLED`. Manter duas respostas diferentes para
 * "posso simular em LIVE?" era convidar a proxima pessoa a escolher a errada.
 */
@Controller('dev/withdrawals')
@Public()
@UseGuards(CombinedAuthGuard)
export class WithdrawalDevController {
  constructor(
    private readonly completeWithdrawalUseCase: CompleteWithdrawalUseCase,
    private readonly failWithdrawalUseCase: FailWithdrawalUseCase,
  ) {}

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
  ): Promise<GetWithdrawalResponseDto> {
    const result = await this.completeWithdrawalUseCase.execute({
      withdrawalId: id,
      storeId,
      requestId: getRequestId(req),
      simulation: true,
      callerEnvironment: environment,
    });

    return {
      withdrawal: WithdrawalResponseDto.fromObject(result.withdrawal),
    };
  }

  @Post(':id/fail')
  @HttpCode(HttpStatus.OK)
  async fail(
    @Param('id') id: string,
    @Body() dto: FailWithdrawalDto,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req?: Request,
  ): Promise<GetWithdrawalResponseDto> {
    const result = await this.failWithdrawalUseCase.execute({
      withdrawalId: id,
      storeId,
      requestId: getRequestId(req),
      reason: dto?.reason ?? 'Withdrawal failed (simulated)',
      simulation: true,
      callerEnvironment: environment,
    });

    return {
      withdrawal: WithdrawalResponseDto.fromObject(result.withdrawal),
    };
  }
}
