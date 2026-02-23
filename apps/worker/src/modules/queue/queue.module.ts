import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CoreModule, EXPIRATION_QUEUE_PORT } from '../core/core.module';
import { WebhookProcessor } from '../../infra/queues/webhook.processor';
import { ExpirationProcessor } from '../../infra/queues/expiration.processor';
import { ExpirationQueue } from '../../infra/queues/expiration.queue';
import { PaymentRepository } from '../../infra/repositories/payment.repository.impl';
import { ExpirePaymentUseCase } from '@hockpay/core';

/**
 * Queue Module
 *
 * Configures BullMQ queues and processors.
 * Also provides ExpirePaymentUseCase to avoid circular dependency.
 */
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    CoreModule,
  ],
  providers: [
    WebhookProcessor,
    ExpirationProcessor,
    {
      provide: EXPIRATION_QUEUE_PORT,
      useClass: ExpirationQueue,
    },
    {
      provide: ExpirePaymentUseCase,
      useFactory: (
        paymentRepository: PaymentRepository,
        expirationQueue: ExpirationQueue,
      ) => new ExpirePaymentUseCase(paymentRepository, expirationQueue),
      inject: [PaymentRepository, EXPIRATION_QUEUE_PORT],
    },
  ],
  exports: [EXPIRATION_QUEUE_PORT, ExpirePaymentUseCase],
})
export class QueueModule {}
