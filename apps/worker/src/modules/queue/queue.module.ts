import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CoreModule, EXPIRATION_QUEUE_PORT } from '../core/core.module';
import { WebhookProcessor } from '../../infra/queues/webhook.processor';
import { AlertProcessor } from '../../infra/queues/alert.processor';
import { ExpirationProcessor } from '../../infra/queues/expiration.processor';
import { WebhookQueue } from '../../infra/queues/webhook.queue';
import { AlertQueue } from '../../infra/queues/alert.queue';
import { ExpirePaymentUseCase, IPaymentRepository, IOutboxRepository } from '@hockpay/core';
import { ExpirationQueue } from '@hockpay/infrastructure';

// Token for IWebhookQueuePort (exported for use in OutboxDispatcherJob)
export const WEBHOOK_QUEUE_PORT = 'IWebhookQueuePort';
export const ALERT_QUEUE_PORT = 'IAlertQueuePort';

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
      {
        name: 'alert-delivery',
        defaultJobOptions: {
          removeOnComplete: {
            count: 1000,
            age: 24 * 60 * 60,
          },
          removeOnFail: {
            age: 7 * 24 * 60 * 60,
          },
        },
      },
    ),
    CoreModule,
  ],
  providers: [
    WebhookProcessor,
    AlertProcessor,
    ExpirationProcessor,
    // Expiration Queue
    {
      provide: EXPIRATION_QUEUE_PORT,
      useFactory: () => new ExpirationQueue(getRedisConnection()),
    },
    // Webhook Queue
    {
      provide: WEBHOOK_QUEUE_PORT,
      useClass: WebhookQueue,
    },
    {
      provide: ALERT_QUEUE_PORT,
      useClass: AlertQueue,
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
  exports: [EXPIRATION_QUEUE_PORT, WEBHOOK_QUEUE_PORT, ALERT_QUEUE_PORT, ExpirePaymentUseCase],
})
export class QueueModule {}

function getRedisConnection() {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  };
}
