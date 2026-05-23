import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { DevController } from './dev.controller';
import {
  CreatePaymentUseCase,
  GetPaymentUseCase,
  GetPaymentTimelineUseCase,
  ListPaymentsUseCase,
  ConfirmPaymentUseCase,
  ExpirePaymentUseCase,
  FailPaymentUseCase,
  ReleasePaymentUseCase,
  SimulateCheckoutPaymentUseCase,
  FeePolicy,
  IPaymentRepository,
  IUnitOfWork,
  ICheckoutSessionRepository,
  IReceiptRepository,
  IRefundRepository,
  ITransactionRepository,
  IWebhookLogRepository,
} from '@hockpay/core';
import {
  CheckoutSessionRepository,
  ExpirationQueue,
  PaymentRepository,
  PixChargeRepository,
  OutboxRepository,
  ReceiptRepository,
  RefundRepository,
  TransactionRepository,
  UnitOfWork,
  WebhookLogRepository,
  parseRedisEnv,
} from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { PixQrCodeGeneratorService } from 'src/infra/services/pix-qr-code-generator.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { JwtService } from 'src/infra/services/jwt.service';

/**
 * Payment Module
 *
 * This module provides payment-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 *
 * Note: ExpirationProcessor has been moved to the Worker app.
 * The API only schedules expiration jobs via ExpirationQueue.
 *
 * Dependencies:
 * - ApiKeyModule: Provides ValidateApiKeyUseCase for CombinedAuthGuard
 */
@Module({
  imports: [
    AuthModule,
    ApiKeyModule, // Provides ValidateApiKeyUseCase
    BullModule.registerQueue({
      name: 'payment-expiration',
    }),
  ],
  controllers: [PaymentController, DevController],
  providers: [
    // Infrastructure
    JwtService,
    PixQrCodeGeneratorService,
    TokenGeneratorService,
    {
      provide: ExpirationQueue,
      useFactory: (config: ConfigService) =>
        new ExpirationQueue(
          parseRedisEnv({
            REDIS_URL: config.get<string>('REDIS_URL'),
            REDIS_HOST: config.get<string>('REDIS_HOST'),
            REDIS_PORT: config.get<string>('REDIS_PORT'),
          }).connection,
        ),
      inject: [ConfigService],
    },

    // Factory providers for shared repositories (from @hockpay/infrastructure)
    {
      provide: 'IPaymentRepository',
      useFactory: (prisma: PrismaService) => new PaymentRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IPixChargeRepository',
      useFactory: (prisma: PrismaService) => new PixChargeRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IOutboxRepository',
      useFactory: (prisma: PrismaService) => new OutboxRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IUnitOfWork',
      useFactory: (prisma: PrismaService) => new UnitOfWork(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'ICheckoutSessionRepository',
      useFactory: (prisma: PrismaService) =>
        new CheckoutSessionRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IReceiptRepository',
      useFactory: (prisma: PrismaService) => new ReceiptRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IRefundRepository',
      useFactory: (prisma: PrismaService) => new RefundRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'ITransactionRepository',
      useFactory: (prisma: PrismaService) => new TransactionRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IWebhookLogRepository',
      useFactory: (prisma: PrismaService) => new WebhookLogRepository(prisma),
      inject: [PrismaService],
    },
    // CombinedAuthGuard (uses ValidateApiKeyUseCase from ApiKeyModule)
    CombinedAuthGuard,

    // Services
    FeePolicy,

    // Use Cases (from core) - injecting interfaces via token
    {
      provide: CreatePaymentUseCase,
      useFactory: (
        unitOfWork: IUnitOfWork,
        pixGenerator: PixQrCodeGeneratorService,
        expirationQueue: ExpirationQueue,
        feePolicy: FeePolicy,
      ) => {
        return new CreatePaymentUseCase(
          unitOfWork,
          pixGenerator,
          expirationQueue,
          feePolicy,
          process.env.PIX_KEY ?? 'test@hockpay.com',
        );
      },
      inject: [
        'IUnitOfWork',
        PixQrCodeGeneratorService,
        ExpirationQueue,
        FeePolicy,
      ],
    },

    {
      provide: GetPaymentUseCase,
      useFactory: (unitOfWork: IUnitOfWork) => {
        return new GetPaymentUseCase(unitOfWork);
      },
      inject: ['IUnitOfWork'],
    },

    {
      provide: GetPaymentTimelineUseCase,
      useFactory: (
        paymentRepo: IPaymentRepository,
        receiptRepo: IReceiptRepository,
        refundRepo: IRefundRepository,
        checkoutSessionRepo: ICheckoutSessionRepository,
        transactionRepo: ITransactionRepository,
        webhookLogRepo: IWebhookLogRepository,
      ) => {
        return new GetPaymentTimelineUseCase(
          paymentRepo,
          receiptRepo,
          refundRepo,
          checkoutSessionRepo,
          transactionRepo,
          webhookLogRepo,
        );
      },
      inject: [
        'IPaymentRepository',
        'IReceiptRepository',
        'IRefundRepository',
        'ICheckoutSessionRepository',
        'ITransactionRepository',
        'IWebhookLogRepository',
      ],
    },

    {
      provide: ListPaymentsUseCase,
      useFactory: (repo: IPaymentRepository) => {
        return new ListPaymentsUseCase(repo);
      },
      inject: ['IPaymentRepository'],
    },

    {
      provide: ConfirmPaymentUseCase,
      useFactory: (unitOfWork: IUnitOfWork) => {
        return new ConfirmPaymentUseCase(unitOfWork);
      },
      inject: ['IUnitOfWork'],
    },

    {
      provide: ExpirePaymentUseCase,
      useFactory: (unitOfWork: IUnitOfWork, queue: ExpirationQueue) => {
        return new ExpirePaymentUseCase(unitOfWork, queue);
      },
      inject: ['IUnitOfWork', ExpirationQueue],
    },

    {
      provide: FailPaymentUseCase,
      useFactory: (unitOfWork: IUnitOfWork, queue: ExpirationQueue) => {
        return new FailPaymentUseCase(unitOfWork, queue);
      },
      inject: ['IUnitOfWork', ExpirationQueue],
    },

    {
      provide: ReleasePaymentUseCase,
      useFactory: (unitOfWork: IUnitOfWork) => {
        return new ReleasePaymentUseCase(unitOfWork);
      },
      inject: ['IUnitOfWork'],
    },

    {
      provide: SimulateCheckoutPaymentUseCase,
      useFactory: (
        paymentRepo: IPaymentRepository,
        checkoutSessionRepo: ICheckoutSessionRepository,
        confirmUseCase: ConfirmPaymentUseCase,
        expireUseCase: ExpirePaymentUseCase,
        failUseCase: FailPaymentUseCase,
      ) => {
        return new SimulateCheckoutPaymentUseCase(
          paymentRepo,
          checkoutSessionRepo,
          confirmUseCase,
          expireUseCase,
          failUseCase,
        );
      },
      inject: [
        'IPaymentRepository',
        'ICheckoutSessionRepository',
        ConfirmPaymentUseCase,
        ExpirePaymentUseCase,
        FailPaymentUseCase,
      ],
    },
  ],
  exports: [
    CreatePaymentUseCase,
    GetPaymentUseCase,
    GetPaymentTimelineUseCase,
    ListPaymentsUseCase,
    ConfirmPaymentUseCase,
    ExpirePaymentUseCase,
    FailPaymentUseCase,
    ReleasePaymentUseCase,
    SimulateCheckoutPaymentUseCase,
    'IPaymentRepository',
    'IPixChargeRepository',
    'ICheckoutSessionRepository',
    'IReceiptRepository',
    'IRefundRepository',
    'ITransactionRepository',
    'IWebhookLogRepository',
  ],
})
export class PaymentModule {}
