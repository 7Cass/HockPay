import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CoreModule, EXPIRATION_QUEUE_PORT } from '../core/core.module';
import { WebhookProcessor } from '../../infra/queues/webhook.processor';
import { AlertProcessor } from '../../infra/queues/alert.processor';
import { ExpirationProcessor } from '../../infra/queues/expiration.processor';
import { WebhookQueue } from '../../infra/queues/webhook.queue';
import { AlertQueue } from '../../infra/queues/alert.queue';
import { ExpirePaymentUseCase, IUnitOfWork } from '@hockpay/core';
import { ExpirationQueue, parseRedisEnv } from '@hockpay/infrastructure';

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
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: parseRedisEnv({
          REDIS_URL: config.get<string>('REDIS_URL'),
          REDIS_HOST: config.get<string>('REDIS_HOST'),
          REDIS_PORT: config.get<string>('REDIS_PORT'),
        }).connection,
      }),
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
      {
        name: 'webhook-dead-letter',
      },
      {
        name: 'alert-dead-letter',
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
      useFactory: (unitOfWork: IUnitOfWork, expirationQueue: ExpirationQueue) =>
        new ExpirePaymentUseCase(unitOfWork, expirationQueue),
      inject: ['IUnitOfWork', EXPIRATION_QUEUE_PORT],
    },
  ],
  exports: [EXPIRATION_QUEUE_PORT, WEBHOOK_QUEUE_PORT, ALERT_QUEUE_PORT, ExpirePaymentUseCase],
})
export class QueueModule {}
