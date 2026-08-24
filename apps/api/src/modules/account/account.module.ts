import { Module } from '@nestjs/common';
import { GetAccountUseCase } from '@hockpay/core';
import { AccountController } from './account.controller';
import { provideUseCase } from '../../common/provide-use-case';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';

/**
 * Account Module
 *
 * AccountRepository vem do InfrastructureModule global.
 */
@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [AccountController],
  providers: [provideUseCase(GetAccountUseCase, ['IAccountRepository'])],
})
export class AccountModule {}
