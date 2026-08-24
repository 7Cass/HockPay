import { Module } from '@nestjs/common';
import { BankAccountController } from './bank-account.controller';
import {
  CreateBankAccountUseCase,
  ListBankAccountsUseCase,
  DeleteBankAccountUseCase,
  SetDefaultBankAccountUseCase,
} from '@hockpay/core';
import { provideUseCase } from 'src/common/provide-use-case';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';

/**
 * Bank Account Module
 *
 * Repositorios e UnitOfWork vem do InfrastructureModule global.
 */
@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [BankAccountController],
  providers: [
    provideUseCase(CreateBankAccountUseCase, ['IUnitOfWork']),
    provideUseCase(ListBankAccountsUseCase, ['IBankAccountRepository']),
    provideUseCase(DeleteBankAccountUseCase, ['IBankAccountRepository']),
    provideUseCase(SetDefaultBankAccountUseCase, ['IUnitOfWork']),
  ],
})
export class BankAccountModule {}
