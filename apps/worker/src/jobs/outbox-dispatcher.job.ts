import { Injectable, Logger, Inject, OnModuleInit, Optional } from '@nestjs/common';
import { IAlertQueuePort, IWebhookQueuePort, IOutboxRepository } from '@hockpay/core';
import { ALERT_QUEUE_PORT, WEBHOOK_QUEUE_PORT } from '../modules/queue/queue.module';
import { createWorkerRequestId } from '../common/request-id';
import { runExclusiveCronJob } from '../common/cron-guard';
import { WorkerCronScheduler } from '../common/worker-cron-scheduler';

/**
 * Outbox Dispatcher Job
 *
 * Polls pending outbox events and dispatches them to the webhook queue.
 * Runs every 10 seconds for low latency webhook delivery.
 */
@Injectable()
export class OutboxDispatcherJob implements OnModuleInit {
  private static readonly DISPATCH_WATCHDOG_MS = 45 * 60 * 1000;
  private static readonly ENQUEUE_RETRY_MS = 60 * 1000;

  private readonly logger = new Logger(OutboxDispatcherJob.name);

  constructor(
    @Inject('IOutboxRepository')
    private readonly outboxRepository: IOutboxRepository,
    @Inject(WEBHOOK_QUEUE_PORT)
    private readonly webhookQueue: IWebhookQueuePort,
    @Inject(ALERT_QUEUE_PORT)
    private readonly alertQueue: IAlertQueuePort,
    @Optional()
    private readonly cronScheduler?: WorkerCronScheduler,
  ) {}

  onModuleInit(): void {
    this.cronScheduler?.registerCronJob({
      name: OutboxDispatcherJob.name,
      envName: 'WORKER_CRON_OUTBOX_DISPATCHER',
      defaultExpression: '*/10 * * * * *',
      onTick: () => this.handleDispatch(),
    });
  }

  /**
   * Dispatch pending outbox events to webhook queue.
   * Runs every 10 seconds.
   */
  async handleDispatch(): Promise<void> {
    await runExclusiveCronJob(OutboxDispatcherJob.name, this.logger, () => this.dispatchEvents());
  }

  private async dispatchEvents(): Promise<void> {
    try {
      const watchdogUntil = this.nextDispatchWatchdog();
      const events = await this.outboxRepository.claimDispatchableEvents({
        limit: 50,
        watchdogUntil,
      });

      if (events.length === 0) {
        return;
      }

      this.logger.log(`Dispatching ${events.length} outbox events to webhook queue`);

      for (const event of events) {
        const requestId = event.requestId ?? createWorkerRequestId('outbox-dispatcher', event.id);
        const paymentId =
          typeof event.payload.id === 'string' ? event.payload.id : event.aggregateId;
        try {
          await this.webhookQueue.enqueue(event.id, undefined, requestId);

          try {
            await this.alertQueue.enqueue(event.id);
          } catch (error) {
            this.logger.warn(
              `Failed to enqueue alert delivery requestId=${requestId} outboxEventId=${event.id} paymentId=${paymentId}`,
              error,
            );
          }

          this.logger.debug(
            `Dispatched webhook event requestId=${requestId} outboxEventId=${event.id} paymentId=${paymentId} eventType=${event.eventType}`,
          );
        } catch (error) {
          event.markAsFailed('Failed to insert webhook job into BullMQ', this.nextEnqueueRetry());
          await this.outboxRepository.update(event);
          this.logger.error(
            `Failed to dispatch webhook event requestId=${requestId} outboxEventId=${event.id} paymentId=${paymentId}`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in outbox dispatcher', error);
    }
  }

  private nextDispatchWatchdog(): Date {
    return new Date(Date.now() + OutboxDispatcherJob.DISPATCH_WATCHDOG_MS);
  }

  private nextEnqueueRetry(): Date {
    return new Date(Date.now() + OutboxDispatcherJob.ENQUEUE_RETRY_MS);
  }
}
