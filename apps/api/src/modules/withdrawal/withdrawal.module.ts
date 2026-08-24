import { Module } from '@nestjs/common';
import {
  CompleteWithdrawalUseCase,
  CreateWithdrawalUseCase,
  FailWithdrawalUseCase,
  GetWithdrawalUseCase,
  ListWithdrawalsUseCase,
  WithdrawalPolicy,
} from '@hockpay/core';
import { provideUseCase } from 'src/common/provide-use-case';
import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { WithdrawalController } from './withdrawal.controller';
import { WithdrawalDevController } from './withdrawal-dev.controller';

/**
 * Withdrawal Module
 *
 * Repositorios e UnitOfWork vem do InfrastructureModule global.
 */
@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [WithdrawalController, WithdrawalDevController],
  providers: [
    CombinedAuthGuard,
    WithdrawalPolicy,

    provideUseCase(CreateWithdrawalUseCase, ['IUnitOfWork', WithdrawalPolicy]),
    provideUseCase(ListWithdrawalsUseCase, [
      'IWithdrawalRepository',
      'IAccountRepository',
    ]),
    provideUseCase(GetWithdrawalUseCase, ['IUnitOfWork']),
    provideUseCase(CompleteWithdrawalUseCase, ['IUnitOfWork']),
    provideUseCase(FailWithdrawalUseCase, ['IUnitOfWork']),
  ],
})
export class WithdrawalModule {}
