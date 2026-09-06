import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  CreateOperatorUseCase,
  GetOperatorUseCase,
  ListOperatorAuditLogsUseCase,
  OperatorLoginUseCase,
  OperatorLogoutUseCase,
  OperatorRefreshTokenUseCase,
} from '@hockpay/core';
import { OperatorAuthController } from './operator-auth.controller';
import { OperatorController } from './operator.controller';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { PasswordHasherService } from 'src/infra/services/password-hasher.service';
import { OperatorJwtService } from 'src/infra/services/operator-jwt.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { provideUseCase } from 'src/common/provide-use-case';

/**
 * Operator Module
 *
 * The operator surface: a principal of its own, authenticated by its own
 * cookie and secret, with an append-only audit trail. No power over merchant
 * data lives here yet -- this slice is the boundary, not the desk.
 */
@Module({
  imports: [ConfigModule],
  controllers: [OperatorAuthController, OperatorController],
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
    provideUseCase(CreateOperatorUseCase, [
      'IUnitOfWork',
      PasswordHasherService,
    ]),
  ],
  exports: [OperatorAuthGuard, CreateOperatorUseCase],
})
export class OperatorModule {}
