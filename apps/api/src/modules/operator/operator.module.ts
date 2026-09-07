import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  CreateOperatorUseCase,
  DecideLiveEnablementUseCase,
  ListStoresForOperatorUseCase,
  GetOperatorUseCase,
  ListOperatorAuditLogsUseCase,
  OperatorLoginUseCase,
  OperatorLogoutUseCase,
  OperatorRefreshTokenUseCase,
} from '@hockpay/core';
import { OperatorAuthController } from './operator-auth.controller';
import { OperatorController } from './operator.controller';
import { OperatorStoreController } from './operator-store.controller';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { PasswordHasherService } from 'src/infra/services/password-hasher.service';
import { OperatorJwtService } from 'src/infra/services/operator-jwt.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { provideUseCase } from 'src/common/provide-use-case';

/**
 * Operator Module
 *
 * The operator surface: a principal of its own, authenticated by its own
 * cookie and secret, with an append-only audit trail.
 *
 * The desk has exactly one power -- opening and closing LIVE for a store --
 * and it cannot be exercised without a reason and a trail line written in the
 * same transaction. Everything else the parent PRD lists (fee, cross-merchant
 * reads, risk review) is still absent, on purpose.
 */
@Module({
  imports: [ConfigModule],
  controllers: [
    OperatorAuthController,
    OperatorController,
    OperatorStoreController,
  ],
  providers: [
    OperatorAuthGuard,
    OperatorJwtService,
    PasswordHasherService,

    provideUseCase(OperatorLoginUseCase, [
      'IUnitOfWork',
      PasswordHasherService,
      OperatorJwtService,
      TokenGeneratorService,
    ]),
    provideUseCase(OperatorRefreshTokenUseCase, [
      'IUnitOfWork',
      OperatorJwtService,
      TokenGeneratorService,
    ]),
    provideUseCase(OperatorLogoutUseCase, ['IUnitOfWork']),
    provideUseCase(GetOperatorUseCase, ['IUnitOfWork']),
    provideUseCase(ListOperatorAuditLogsUseCase, ['IUnitOfWork']),
    provideUseCase(ListStoresForOperatorUseCase, ['IUnitOfWork']),
    provideUseCase(DecideLiveEnablementUseCase, ['IUnitOfWork']),
    provideUseCase(CreateOperatorUseCase, [
      'IUnitOfWork',
      PasswordHasherService,
    ]),
  ],
  exports: [OperatorAuthGuard, CreateOperatorUseCase],
})
export class OperatorModule {}
