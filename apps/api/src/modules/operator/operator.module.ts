import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  CreateOperatorUseCase,
  DecideLiveEnablementUseCase,
  GetAccountUseCase,
  GetPaymentTimelineUseCase,
  GetStoreForOperatorUseCase,
  ListPaymentsUseCase,
  ListStoresForOperatorUseCase,
  ListTransactionsUseCase,
  ListWebhookConfigsUseCase,
  ListWebhookLogsUseCase,
  GetOperatorUseCase,
  ListOperatorAuditLogsUseCase,
  OperatorLoginUseCase,
  OperatorLogoutUseCase,
  OperatorRefreshTokenUseCase,
  UpdateCommercialTermsUseCase,
} from '@hockpay/core';
import { OperatorAuthController } from './operator-auth.controller';
import { OperatorController } from './operator.controller';
import { OperatorStoreController } from './operator-store.controller';
import { OperatorStoreReadController } from './operator-store-read.controller';
import { OperatorAuthGuard } from './guards/operator-auth.guard';
import { PasswordHasherService } from 'src/infra/services/password-hasher.service';
import { OperatorJwtService } from 'src/infra/services/operator-jwt.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { provideUseCase } from 'src/common/provide-use-case';
import {
  WEBHOOK_CIRCUIT_BREAKER,
  webhookCircuitBreakerProvider,
} from '../webhook/webhook-circuit-breaker.provider';

/**
 * Operator Module
 *
 * The operator surface: a principal of its own, authenticated by its own
 * cookie and secret, with an append-only audit trail.
 *
 * The desk has two powers over a store -- opening and closing LIVE, and setting
 * its commercial condition -- and neither can be exercised without a reason and
 * a trail line written in the same transaction. It also reads any store's data
 * to investigate a case, reusing the merchant surface's own use cases rather
 * than growing a parallel read path.
 *
 * What the parent PRD still lists as absent: risk review, and any operator
 * write over a merchant's data. The desk does not move money.
 */
@Module({
  imports: [ConfigModule],
  controllers: [
    OperatorAuthController,
    OperatorController,
    OperatorStoreController,
    OperatorStoreReadController,
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
    provideUseCase(UpdateCommercialTermsUseCase, ['IUnitOfWork']),
    provideUseCase(GetStoreForOperatorUseCase, ['IUnitOfWork']),

    // Cross-merchant reads. These are the merchant surface's own use cases,
    // wired here with the same ports: the operator sees exactly what the
    // merchant sees, of a store they choose.
    webhookCircuitBreakerProvider,
    provideUseCase(ListPaymentsUseCase, ['IPaymentRepository']),
    provideUseCase(GetPaymentTimelineUseCase, [
      'IPaymentRepository',
      'IReceiptRepository',
      'IRefundRepository',
      'ICheckoutSessionRepository',
      'ITransactionRepository',
      'IWebhookLogRepository',
    ]),
    provideUseCase(GetAccountUseCase, ['IAccountRepository']),
    provideUseCase(ListTransactionsUseCase, [
      'ITransactionRepository',
      'IAccountRepository',
    ]),
    provideUseCase(ListWebhookConfigsUseCase, [
      'IWebhookConfigRepository',
      WEBHOOK_CIRCUIT_BREAKER,
    ]),
    provideUseCase(ListWebhookLogsUseCase, [
      'IWebhookLogRepository',
      'IWebhookConfigRepository',
    ]),
    provideUseCase(CreateOperatorUseCase, [
      'IUnitOfWork',
      PasswordHasherService,
    ]),
  ],
  exports: [OperatorAuthGuard, CreateOperatorUseCase],
})
export class OperatorModule {}
