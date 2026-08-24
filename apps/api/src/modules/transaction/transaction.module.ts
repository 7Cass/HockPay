import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { ListTransactionsUseCase } from '@hockpay/core';
import { provideUseCase } from 'src/common/provide-use-case';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';

/**
 * Transaction Module
 *
 * Provides endpoints for retrieving transaction ledgers.
 *
 * Repositorios vem do InfrastructureModule global.
 */
@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [TransactionController],
  providers: [
    CombinedAuthGuard,

    provideUseCase(ListTransactionsUseCase, [
      'ITransactionRepository',
      'IAccountRepository',
    ]),
  ],
})
export class TransactionModule {}
