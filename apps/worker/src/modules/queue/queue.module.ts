import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CoreModule, EXPIRATION_QUEUE_PORT } from '../core/core.module';
import { WebhookProcessor } from '../../infra/queues/webhook.processor';
import { ExpirationProcessor } from '../../infra/queues/expiration.processor';
import { ExpirationQueue } from '../../infra/queues/expiration.queue';
import { WebhookQueue } from '../../infra/queues/webhook.queue';
import { ExpirePaymentUseCase, IPaymentRepository, IOutboxRepository } from '@hockpay/core';

// Token for IWebhookQueuePort (exported for use in OutboxDispatcherJob)
export const WEBHOOK_QUEUE_PORT = 'IWebhookQueuePort';

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
    // Register queues for @InjectQueue to work
    BullModule.registerQueue(
      {
        name: 'webhook-delivery',
        defaultJobOptions: {
          removeOnComplete: {
            count: 1000,
            age: 24 * 60 * 60, // 24 hours
          },
          removeOnFail: {
            age: 7 * 24 * 60 * 60, // 7 days
          },
        },
      },
      {
        name: 'payment-expiration',
      },
    ),
    CoreModule,
  ],
  providers: [
    WebhookProcessor,
    ExpirationProcessor,
    // Expiration Queue
    {
      provide: EXPIRATION_QUEUE_PORT,
      useClass: ExpirationQueue,
    },
    // Webhook Queue
    {
      provide: WEBHOOK_QUEUE_PORT,
      useClass: WebhookQueue,
    },
    // ExpirePaymentUseCase with repository interfaces
    {
      provide: ExpirePaymentUseCase,
      useFactory: (
        paymentRepository: IPaymentRepository,
        outboxRepository: IOutboxRepository,
        expirationQueue: ExpirationQueue,
      ) => new ExpirePaymentUseCase(paymentRepository, outboxRepository, expirationQueue),
      inject: ['IPaymentRepository', 'IOutboxRepository', EXPIRATION_QUEUE_PORT],
    },
  ],
  exports: [EXPIRATION_QUEUE_PORT, WEBHOOK_QUEUE_PORT, ExpirePaymentUseCase],
})
export class QueueModule {}
