import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/database/prisma.module';

// Repositories
import { OutboxRepository } from '../../infra/repositories/outbox.repository.impl';
import { WebhookConfigRepository } from '../../infra/repositories/webhook-config.repository.impl';
import { WebhookLogRepository } from '../../infra/repositories/webhook-log.repository.impl';
import { AccountRepository } from '../../infra/repositories/account.repository.impl';
import { TransactionRepository } from '../../infra/repositories/transaction.repository.impl';
import { PaymentRepository } from '../../infra/repositories/payment.repository.impl';

// Services
import { HmacSignerService } from '../../infra/crypto/hmac-signer.service';
import { WebhookHttpClientService } from '../../infra/http/webhook-http-client.service';

// Use Cases
import {
  ProcessWebhookUseCase,
  ReleasePaymentUseCase,
  CleanupLogsUseCase,
  DetectAnomaliesUseCase,
} from '@hockpay/core';

// Token for IExpirationQueuePort (exported for use in QueueModule)
export const EXPIRATION_QUEUE_PORT = 'IExpirationQueuePort';

/**
 * Core Module
 *
 * Wires up all use cases with their dependencies (repositories, services).
 * Note: ExpirePaymentUseCase is provided in QueueModule to avoid circular dependency.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    // Repositories
    OutboxRepository,
    WebhookConfigRepository,
    WebhookLogRepository,
    AccountRepository,
    TransactionRepository,
    PaymentRepository,

    // Services
    HmacSignerService,
    WebhookHttpClientService,

    // Use Cases
    {
      provide: ProcessWebhookUseCase,
      useFactory: (
        outboxRepository: OutboxRepository,
        webhookConfigRepository: WebhookConfigRepository,
        webhookLogRepository: WebhookLogRepository,
        webhookSender: WebhookHttpClientService,
        hmacSigner: HmacSignerService,
      ) =>
        new ProcessWebhookUseCase(
          outboxRepository,
          webhookConfigRepository,
          webhookLogRepository,
          webhookSender,
          hmacSigner,
        ),
      inject: [
        OutboxRepository,
        WebhookConfigRepository,
        WebhookLogRepository,
        WebhookHttpClientService,
        HmacSignerService,
      ],
    },
    {
      provide: ReleasePaymentUseCase,
      useFactory: (
        paymentRepository: PaymentRepository,
        accountRepository: AccountRepository,
        transactionRepository: TransactionRepository,
      ) =>
        new ReleasePaymentUseCase(
          paymentRepository,
          accountRepository,
          transactionRepository,
        ),
      inject: [PaymentRepository, AccountRepository, TransactionRepository],
    },
    {
      provide: CleanupLogsUseCase,
      useFactory: (
        webhookLogRepository: WebhookLogRepository,
        outboxRepository: OutboxRepository,
      ) => new CleanupLogsUseCase(webhookLogRepository, outboxRepository),
      inject: [WebhookLogRepository, OutboxRepository],
    },
    {
      provide: DetectAnomaliesUseCase,
      useFactory: (paymentRepository: PaymentRepository) =>
        new DetectAnomaliesUseCase(paymentRepository),
      inject: [PaymentRepository],
    },
  ],
  exports: [
    // Repositories
    OutboxRepository,
    WebhookConfigRepository,
    WebhookLogRepository,
    AccountRepository,
    TransactionRepository,
    PaymentRepository,
    // Use Cases
    ProcessWebhookUseCase,
    ReleasePaymentUseCase,
    CleanupLogsUseCase,
    DetectAnomaliesUseCase,
  ],
})
export class CoreModule {}
