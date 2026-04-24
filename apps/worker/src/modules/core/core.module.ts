import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/database/prisma.module';
import { PrismaService } from '../../infra/database/prisma.service';

// Repositories
import {
  OutboxRepository,
  PaymentRepository,
  WebhookConfigRepository,
  WebhookLogRepository,
  AlertConfigRepository,
  AlertDeliveryLogRepository,
  DiscordAlertSenderService,
  IdempotencyKeyRepository,
  UnitOfWork,
} from '@hockpay/infrastructure';
import { AccountRepository } from '../../infra/repositories/account.repository.impl';
import { TransactionRepository } from '../../infra/repositories/transaction.repository.impl';

// Services
import { HmacSignerService } from '../../infra/crypto/hmac-signer.service';
import { WebhookHttpClientService } from '../../infra/http/webhook-http-client.service';
import { EncryptionService } from '../../infra/services/encryption.service';

// Use Cases
import {
  ProcessWebhookUseCase,
  ProcessAlertDeliveryUseCase,
  ReleasePaymentUseCase,
  CleanupLogsUseCase,
  DetectAnomaliesUseCase,
  IPaymentRepository,
  IOutboxRepository,
  IWebhookConfigRepository,
  IWebhookLogRepository,
  IAlertConfigRepository,
  IAlertDeliveryLogRepository,
  IUnitOfWork,
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
    // Factory providers for shared repositories (from @hockpay/infrastructure)
    {
      provide: 'IPaymentRepository',
      useFactory: (prisma: PrismaService) => new PaymentRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IOutboxRepository',
      useFactory: (prisma: PrismaService) => new OutboxRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IWebhookConfigRepository',
      useFactory: (prisma: PrismaService) => new WebhookConfigRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IWebhookLogRepository',
      useFactory: (prisma: PrismaService) => new WebhookLogRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IAlertConfigRepository',
      useFactory: (prisma: PrismaService) => new AlertConfigRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IAlertDeliveryLogRepository',
      useFactory: (prisma: PrismaService) => new AlertDeliveryLogRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IIdempotencyKeyRepository',
      useFactory: (prisma: PrismaService) => new IdempotencyKeyRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IUnitOfWork',
      useFactory: (prisma: PrismaService) => new UnitOfWork(prisma),
      inject: [PrismaService],
    },

    // Local repositories (still using @Injectable)
    AccountRepository,
    TransactionRepository,

    // Services
    HmacSignerService,
    WebhookHttpClientService,
    EncryptionService,
    DiscordAlertSenderService,

    // Use Cases
    {
      provide: ProcessWebhookUseCase,
      useFactory: (
        outboxRepository: IOutboxRepository,
        webhookConfigRepository: IWebhookConfigRepository,
        webhookLogRepository: IWebhookLogRepository,
        webhookSender: WebhookHttpClientService,
        hmacSigner: HmacSignerService,
        encryption: EncryptionService,
      ) =>
        new ProcessWebhookUseCase(
          outboxRepository,
          webhookConfigRepository,
          webhookLogRepository,
          webhookSender,
          hmacSigner,
          encryption,
        ),
      inject: [
        'IOutboxRepository',
        'IWebhookConfigRepository',
        'IWebhookLogRepository',
        WebhookHttpClientService,
        HmacSignerService,
        EncryptionService,
      ],
    },
    {
      provide: ReleasePaymentUseCase,
      useFactory: (unitOfWork: IUnitOfWork) => new ReleasePaymentUseCase(unitOfWork),
      inject: ['IUnitOfWork'],
    },
    {
      provide: ProcessAlertDeliveryUseCase,
      useFactory: (
        outboxRepository: IOutboxRepository,
        alertConfigRepository: IAlertConfigRepository,
        alertLogRepository: IAlertDeliveryLogRepository,
        alertSender: DiscordAlertSenderService,
        encryption: EncryptionService,
      ) =>
        new ProcessAlertDeliveryUseCase(
          outboxRepository,
          alertConfigRepository,
          alertLogRepository,
          alertSender,
          encryption,
        ),
      inject: [
        'IOutboxRepository',
        'IAlertConfigRepository',
        'IAlertDeliveryLogRepository',
        DiscordAlertSenderService,
        EncryptionService,
      ],
    },
    {
      provide: CleanupLogsUseCase,
      useFactory: (
        webhookLogRepository: IWebhookLogRepository,
        outboxRepository: IOutboxRepository,
      ) => new CleanupLogsUseCase(webhookLogRepository, outboxRepository),
      inject: ['IWebhookLogRepository', 'IOutboxRepository'],
    },
    {
      provide: DetectAnomaliesUseCase,
      useFactory: (paymentRepository: IPaymentRepository) =>
        new DetectAnomaliesUseCase(paymentRepository),
      inject: ['IPaymentRepository'],
    },
  ],
  exports: [
    // Repositories (tokens for shared)
    'IPaymentRepository',
    'IOutboxRepository',
    'IWebhookConfigRepository',
    'IWebhookLogRepository',
    'IAlertConfigRepository',
    'IAlertDeliveryLogRepository',
    'IIdempotencyKeyRepository',
    AccountRepository,
    TransactionRepository,
    // Use Cases
    ProcessWebhookUseCase,
    ProcessAlertDeliveryUseCase,
    ReleasePaymentUseCase,
    CleanupLogsUseCase,
    DetectAnomaliesUseCase,
  ],
})
export class CoreModule { }
