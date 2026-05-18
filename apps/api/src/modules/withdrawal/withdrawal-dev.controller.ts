import {
  BadRequestException,
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
    @Req() req?: Request,
  ): Promise<GetWithdrawalResponseDto> {
    this.validateTestEnvironment(req);
    const result = await this.completeWithdrawalUseCase.execute({
      withdrawalId: id,
      storeId: this.getStoreId(req),
      requestId: getRequestId(req),
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
    @Req() req?: Request,
  ): Promise<GetWithdrawalResponseDto> {
    this.validateTestEnvironment(req);
    const result = await this.failWithdrawalUseCase.execute({
      withdrawalId: id,
      storeId: this.getStoreId(req),
      requestId: getRequestId(req),
      reason: dto?.reason ?? 'Withdrawal failed (simulated)',
    });

    return {
      withdrawal: WithdrawalResponseDto.fromObject(result.withdrawal),
    };
  }

  private validateTestEnvironment(req?: Request): void {
    const environment = (req as any)?.environment as Environment | undefined;
    if (environment === Environment.LIVE) {
      throw new BadRequestException({
        error: {
          code: 'LIVE_ENVIRONMENT_NOT_ALLOWED',
          message:
            'Dev withdrawal endpoints are not available in LIVE environment',
        },
      });
    }
  }

  private getStoreId(req?: Request): string {
    const storeId = (req as any)?.store?.id ?? (req as any)?.user?.storeId;
    if (!storeId) {
      throw new Error('Store ID not found in request');
    }
    return storeId;
  }
}
