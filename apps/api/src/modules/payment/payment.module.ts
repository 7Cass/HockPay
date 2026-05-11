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
  SimulateCheckoutPaymentUseCase,
  FeePolicy,
  IPaymentRepository,
  IOutboxRepository,
  IUnitOfWork,
  ICheckoutSessionRepository,
} from '@hockpay/core';
import {
  CheckoutSessionRepository,
  PaymentRepository,
  OutboxRepository,
  UnitOfWork,
} from '@hockpay/infrastructure';
import { CustomerRepository } from 'src/infra/repositories/customer.repository.impl';
import { StoreRepository } from 'src/infra/repositories/store.repository.impl';
import { PrismaService } from 'src/infra/database/prisma.service';
import { PixQrCodeGeneratorService } from 'src/infra/services/pix-qr-code-generator.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
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
    JwtService,
    PixQrCodeGeneratorService,
    TokenGeneratorService,
    ExpirationQueue,

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

    // Local repositories (still using @Injectable)
    CustomerRepository,
    StoreRepository,

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
      provide: ListPaymentsUseCase,
      useFactory: (repo: IPaymentRepository) => {
        return new ListPaymentsUseCase(repo);
      },
      inject: ['IPaymentRepository'],
    },

    {
      provide: ConfirmPaymentUseCase,
      useFactory: (
        unitOfWork: IUnitOfWork,
        customerRepo: CustomerRepository,
      ) => {
        return new ConfirmPaymentUseCase(unitOfWork, customerRepo);
      },
      inject: ['IUnitOfWork', CustomerRepository],
    },

    {
      provide: ExpirePaymentUseCase,
      useFactory: (
        repo: IPaymentRepository,
        outboxRepo: IOutboxRepository,
        queue: ExpirationQueue,
      ) => {
        return new ExpirePaymentUseCase(repo, outboxRepo, queue);
      },
      inject: ['IPaymentRepository', 'IOutboxRepository', ExpirationQueue],
    },

    {
      provide: FailPaymentUseCase,
      useFactory: (
        repo: IPaymentRepository,
        outboxRepo: IOutboxRepository,
        queue: ExpirationQueue,
      ) => {
        return new FailPaymentUseCase(repo, outboxRepo, queue);
      },
      inject: ['IPaymentRepository', 'IOutboxRepository', ExpirationQueue],
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
    ListPaymentsUseCase,
    ConfirmPaymentUseCase,
    ExpirePaymentUseCase,
    FailPaymentUseCase,
    SimulateCheckoutPaymentUseCase,
    'IPaymentRepository',
    'ICheckoutSessionRepository',
  ],
})
export class PaymentModule {}
