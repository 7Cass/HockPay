import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  CreateOperatorUseCase,
  CreateRefundUseCase,
  CreateWithdrawalUseCase,
  DecideLiveEnablementUseCase,
  GetAccountUseCase,
  GetPaymentTimelineUseCase,
  GetStoreForOperatorUseCase,
  ListBankAccountsUseCase,
  ListPaymentsUseCase,
  ListStoresForOperatorUseCase,
  ListTransactionsUseCase,
  ListWebhookConfigsUseCase,
  ListWebhookLogsUseCase,
  GetOperatorUseCase,
  ListOperatorAuditLogsUseCase,
  OperatorLoginUseCase,
  OperatorLogoutUseCase,
  OperatorCreateRefundUseCase,
  OperatorCreateWithdrawalUseCase,
  OperatorRefreshTokenUseCase,
  UpdateCommercialTermsUseCase,
} from '@hockpay/core';
import { OperatorAuthController } from './operator-auth.controller';
import { OperatorController } from './operator.controller';
import { OperatorStoreController } from './operator-store.controller';
import { OperatorStoreReadController } from './operator-store-read.controller';
import { OperatorStoreMoneyController } from './operator-store-money.controller';
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
 * Since `2026-09-09` it also moves money for a store, and that is the point of
 * the suspension rule rather than an exception to it: a store the desk closed
 * stops withdrawing and refunding on its own, and this is the way its balance
 * still gets out. That surface lives in its own controller, because writing to
 * the ledger costs an idempotency key and a trail line that deciding about a
 * store does not.
 *
 * What the parent PRD still lists as absent: risk review.
 */
@Module({
  imports: [ConfigModule],
  controllers: [
    OperatorAuthController,
    OperatorController,
    OperatorStoreController,
    OperatorStoreReadController,
    OperatorStoreMoneyController,
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

    // Moving money for a store. The desk does not own a ledger path: these are
    // the merchant's own use cases, wrapped by an operator use case that adds
    // the reason and the trail line inside the same transaction.
    provideUseCase(CreateWithdrawalUseCase, ['IUnitOfWork']),
    provideUseCase(CreateRefundUseCase, ['IUnitOfWork']),
    provideUseCase(OperatorCreateWithdrawalUseCase, [
      'IUnitOfWork',
      CreateWithdrawalUseCase,
    ]),
    provideUseCase(OperatorCreateRefundUseCase, [
      'IUnitOfWork',
      CreateRefundUseCase,
    ]),

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
    // Where a withdrawal by the desk can go. Without it the desk would withdraw
    // to a destination id pasted from somewhere else.
    provideUseCase(ListBankAccountsUseCase, ['IBankAccountRepository']),
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
