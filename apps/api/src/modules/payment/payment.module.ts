import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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
} from '@hockpay/core';
import { ExpirationQueue } from '@hockpay/infrastructure';
import { PixQrCodeGeneratorService } from 'src/infra/services/pix-qr-code-generator.service';
import { provideUseCase } from 'src/common/provide-use-case';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';

/**
 * Payment Module
 *
 * This module provides payment-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 *
 * Note: ExpirationProcessor has been moved to the Worker app.
 * The API only schedules expiration jobs via ExpirationQueue.
 *
 * Repositorios, ExpirationQueue e adapters vem do InfrastructureModule global.
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
    CombinedAuthGuard,
    FeePolicy,

    provideUseCase(
      CreatePaymentUseCase,
      ['IUnitOfWork', PixQrCodeGeneratorService, ExpirationQueue, FeePolicy],
      () => [process.env.PIX_KEY ?? 'test@hockpay.com'],
    ),
    provideUseCase(GetPaymentUseCase, ['IUnitOfWork']),
    provideUseCase(GetPaymentTimelineUseCase, [
      'IPaymentRepository',
      'IReceiptRepository',
      'IRefundRepository',
      'ICheckoutSessionRepository',
      'ITransactionRepository',
      'IWebhookLogRepository',
    ]),
    provideUseCase(ListPaymentsUseCase, ['IPaymentRepository']),
    provideUseCase(ConfirmPaymentUseCase, ['IUnitOfWork']),
    provideUseCase(ExpirePaymentUseCase, ['IUnitOfWork', ExpirationQueue]),
    provideUseCase(FailPaymentUseCase, ['IUnitOfWork', ExpirationQueue]),
    provideUseCase(ReleasePaymentUseCase, ['IUnitOfWork']),
    provideUseCase(SimulateCheckoutPaymentUseCase, [
      'IPaymentRepository',
      'ICheckoutSessionRepository',
      ConfirmPaymentUseCase,
      ExpirePaymentUseCase,
      FailPaymentUseCase,
    ]),
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
  ],
})
export class PaymentModule {}
