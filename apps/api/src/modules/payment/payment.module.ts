import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentController } from './payment.controller';
import { DevController } from './dev.controller';
import {
  CreatePaymentUseCase,
  GetPaymentUseCase,
  ListPaymentsUseCase,
  ConfirmPaymentUseCase,
  ExpirePaymentUseCase,
  FailPaymentUseCase,
  FeePolicy,
} from '@hockpay/core';
import { PaymentRepository } from 'src/infra/repositories/payment.repository.impl';
import { CustomerRepository } from 'src/infra/repositories/customer.repository.impl';
import { StoreRepository } from 'src/infra/repositories/store.repository.impl';
import { PrismaService } from 'src/infra/database/prisma.service';
import { PixQrCodeGeneratorService } from 'src/infra/services/pix-qr-code-generator.service';
import { ExpirationQueue } from 'src/infra/queues/expiration.queue';
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
    PrismaService,
    PaymentRepository,
    CustomerRepository,
    StoreRepository,
    JwtService,
    PixQrCodeGeneratorService,
    ExpirationQueue,

    // CombinedAuthGuard (uses ValidateApiKeyUseCase from ApiKeyModule)
    CombinedAuthGuard,

    // Services
    FeePolicy,

    // Use Cases (from core)
    {
      provide: CreatePaymentUseCase,
      useFactory: (
        paymentRepo: PaymentRepository,
        customerRepo: CustomerRepository,
        storeRepo: StoreRepository,
        pixGenerator: PixQrCodeGeneratorService,
        expirationQueue: ExpirationQueue,
        feePolicy: FeePolicy,
      ) => {
        return new CreatePaymentUseCase(
          paymentRepo,
          customerRepo,
          storeRepo,
          pixGenerator,
          expirationQueue,
          feePolicy,
          process.env.PIX_KEY ?? 'test@hockpay.com',
          process.env.CHECKOUT_BASE_URL ?? 'http://localhost:4200',
        );
      },
      inject: [
        PaymentRepository,
        CustomerRepository,
        StoreRepository,
        PixQrCodeGeneratorService,
        ExpirationQueue,
        FeePolicy,
      ],
    },

    {
      provide: GetPaymentUseCase,
      useFactory: (repo: PaymentRepository) => {
        return new GetPaymentUseCase(repo);
      },
      inject: [PaymentRepository],
    },

    {
      provide: ListPaymentsUseCase,
      useFactory: (repo: PaymentRepository) => {
        return new ListPaymentsUseCase(repo);
      },
      inject: [PaymentRepository],
    },

    {
      provide: ConfirmPaymentUseCase,
      useFactory: (repo: PaymentRepository) => {
        return new ConfirmPaymentUseCase(repo);
      },
      inject: [PaymentRepository],
    },

    {
      provide: ExpirePaymentUseCase,
      useFactory: (
        repo: PaymentRepository,
        queue: ExpirationQueue,
      ) => {
        return new ExpirePaymentUseCase(repo, queue);
      },
      inject: [PaymentRepository, ExpirationQueue],
    },

    {
      provide: FailPaymentUseCase,
      useFactory: (repo: PaymentRepository) => {
        return new FailPaymentUseCase(repo);
      },
      inject: [PaymentRepository],
    },
  ],
  exports: [
    CreatePaymentUseCase,
    GetPaymentUseCase,
    ListPaymentsUseCase,
    ConfirmPaymentUseCase,
    ExpirePaymentUseCase,
    FailPaymentUseCase,
  ],
})
export class PaymentModule {}
