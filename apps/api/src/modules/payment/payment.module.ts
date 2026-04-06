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
  ITokenGeneratorPort,
  IUnitOfWork,
} from '@hockpay/core';
import {
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
        paymentRepo: IPaymentRepository,
        customerRepo: CustomerRepository,
        storeRepo: StoreRepository,
        outboxRepo: IOutboxRepository,
        pixGenerator: PixQrCodeGeneratorService,
        expirationQueue: ExpirationQueue,
        feePolicy: FeePolicy,
      ) => {
        return new CreatePaymentUseCase(
          paymentRepo,
          customerRepo,
          storeRepo,
          outboxRepo,
          pixGenerator,
          expirationQueue,
          feePolicy,
          process.env.PIX_KEY ?? 'test@hockpay.com',
        );
      },
      inject: [
        'IPaymentRepository',
        CustomerRepository,
        StoreRepository,
        'IOutboxRepository',
        PixQrCodeGeneratorService,
        ExpirationQueue,
        FeePolicy,
      ],
    },

    {
      provide: GetPaymentUseCase,
      useFactory: (repo: IPaymentRepository) => {
        return new GetPaymentUseCase(repo);
      },
      inject: ['IPaymentRepository'],
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
      useFactory: (repo: IPaymentRepository, outboxRepo: IOutboxRepository) => {
        return new FailPaymentUseCase(repo, outboxRepo);
      },
      inject: ['IPaymentRepository', 'IOutboxRepository'],
    },

    {
      provide: SimulateCheckoutPaymentUseCase,
      useFactory: (
        paymentRepo: IPaymentRepository,
        confirmUseCase: ConfirmPaymentUseCase,
        expireUseCase: ExpirePaymentUseCase,
        failUseCase: FailPaymentUseCase,
      ) => {
        return new SimulateCheckoutPaymentUseCase(
          paymentRepo,
          confirmUseCase,
          expireUseCase,
          failUseCase,
        );
      },
      inject: [
        'IPaymentRepository',
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
  ],
})
export class PaymentModule {}
