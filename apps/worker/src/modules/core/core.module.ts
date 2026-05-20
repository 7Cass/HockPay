import { Logger, Module } from "@nestjs/common";
import { PrismaModule } from "../../infra/database/prisma.module";
import { PrismaService } from "../../infra/database/prisma.service";

// Repositories
import {
  OutboxRepository,
  PaymentRepository,
  WebhookConfigRepository,
  WebhookLogRepository,
  AlertConfigRepository,
  AlertDeliveryLogRepository,
  DiscordAlertSenderService,
  EncryptionService,
  HmacSignerService,
  IdempotencyKeyRepository,
  AccountRepository,
  TransactionRepository,
  UnitOfWork,
  WithdrawalRepository,
  WebhookHttpClientService,
} from "@hockpay/infrastructure";

// Use Cases
import {
  ProcessWebhookUseCase,
  ProcessAlertDeliveryUseCase,
  ReleasePaymentUseCase,
  CompleteWithdrawalUseCase,
  CleanupLogsUseCase,
  DetectAnomaliesUseCase,
  FailWithdrawalUseCase,
  IPaymentRepository,
  IWithdrawalRepository,
  IOutboxRepository,
  IWebhookConfigRepository,
  IWebhookLogRepository,
  IAlertConfigRepository,
  IAlertDeliveryLogRepository,
  IUnitOfWork,
  MarkWithdrawalProcessingUseCase,
  RecordWithdrawalProcessingErrorUseCase,
  getWebhookUrlPolicyOptionsForNodeEnv,
} from "@hockpay/core";

// Token for IExpirationQueuePort (exported for use in QueueModule)
export const EXPIRATION_QUEUE_PORT = "IExpirationQueuePort";

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
      provide: "IPaymentRepository",
      useFactory: (prisma: PrismaService) => new PaymentRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: "IOutboxRepository",
      useFactory: (prisma: PrismaService) => new OutboxRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: "IWebhookConfigRepository",
      useFactory: (prisma: PrismaService) =>
        new WebhookConfigRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: "IWebhookLogRepository",
      useFactory: (prisma: PrismaService) => new WebhookLogRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: "IAlertConfigRepository",
      useFactory: (prisma: PrismaService) => new AlertConfigRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: "IAlertDeliveryLogRepository",
      useFactory: (prisma: PrismaService) =>
        new AlertDeliveryLogRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: "IIdempotencyKeyRepository",
      useFactory: (prisma: PrismaService) =>
        new IdempotencyKeyRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: "IUnitOfWork",
      useFactory: (prisma: PrismaService) => new UnitOfWork(prisma),
      inject: [PrismaService],
    },
    {
      provide: "IWithdrawalRepository",
      useFactory: (prisma: PrismaService) => new WithdrawalRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: AccountRepository,
      useFactory: (prisma: PrismaService) => new AccountRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: TransactionRepository,
      useFactory: (prisma: PrismaService) => new TransactionRepository(prisma),
      inject: [PrismaService],
    },

    // Services
    {
      provide: HmacSignerService,
      useFactory: () => new HmacSignerService(),
    },
    {
      provide: WebhookHttpClientService,
      useFactory: () =>
        new WebhookHttpClientService({
          logger: new Logger(WebhookHttpClientService.name),
          webhookUrlPolicyOptions: getWebhookUrlPolicyOptionsForNodeEnv(
            process.env.NODE_ENV,
          ),
        }),
    },
    {
      provide: EncryptionService,
      useFactory: () => new EncryptionService(getRequiredEnv("ENCRYPTION_KEY")),
    },
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
          new Logger(ProcessWebhookUseCase.name),
        ),
      inject: [
        "IOutboxRepository",
        "IWebhookConfigRepository",
        "IWebhookLogRepository",
        WebhookHttpClientService,
        HmacSignerService,
        EncryptionService,
      ],
    },
    {
      provide: ReleasePaymentUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new ReleasePaymentUseCase(unitOfWork),
      inject: ["IUnitOfWork"],
    },
    {
      provide: MarkWithdrawalProcessingUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new MarkWithdrawalProcessingUseCase(unitOfWork),
      inject: ["IUnitOfWork"],
    },
    {
      provide: CompleteWithdrawalUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new CompleteWithdrawalUseCase(unitOfWork),
      inject: ["IUnitOfWork"],
    },
    {
      provide: FailWithdrawalUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new FailWithdrawalUseCase(unitOfWork),
      inject: ["IUnitOfWork"],
    },
    {
      provide: RecordWithdrawalProcessingErrorUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new RecordWithdrawalProcessingErrorUseCase(unitOfWork),
      inject: ["IUnitOfWork"],
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
        "IOutboxRepository",
        "IAlertConfigRepository",
        "IAlertDeliveryLogRepository",
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
      inject: ["IWebhookLogRepository", "IOutboxRepository"],
    },
    {
      provide: DetectAnomaliesUseCase,
      useFactory: (paymentRepository: IPaymentRepository) =>
        new DetectAnomaliesUseCase(paymentRepository),
      inject: ["IPaymentRepository"],
    },
  ],
  exports: [
    // Repositories (tokens for shared)
    "IPaymentRepository",
    "IOutboxRepository",
    "IWebhookConfigRepository",
    "IWebhookLogRepository",
    "IAlertConfigRepository",
    "IAlertDeliveryLogRepository",
    "IIdempotencyKeyRepository",
    "IUnitOfWork",
    "IWithdrawalRepository",
    AccountRepository,
    TransactionRepository,
    // Use Cases
    ProcessWebhookUseCase,
    ProcessAlertDeliveryUseCase,
    ReleasePaymentUseCase,
    MarkWithdrawalProcessingUseCase,
    CompleteWithdrawalUseCase,
    FailWithdrawalUseCase,
    RecordWithdrawalProcessingErrorUseCase,
    CleanupLogsUseCase,
    DetectAnomaliesUseCase,
  ],
})
export class CoreModule {}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}
