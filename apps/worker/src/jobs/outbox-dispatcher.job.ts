import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IWebhookQueuePort, IOutboxRepository } from '@hockpay/core';
import { WEBHOOK_QUEUE_PORT } from '../modules/queue/queue.module';

/**
 * Outbox Dispatcher Job
 *
 * Polls pending outbox events and dispatches them to the webhook queue.
 * Runs every 10 seconds for low latency webhook delivery.
 */
@Injectable()
export class OutboxDispatcherJob {
  private readonly logger = new Logger(OutboxDispatcherJob.name);
  private isProcessing = false;

  constructor(
    @Inject('IOutboxRepository')
    private readonly outboxRepository: IOutboxRepository,
    @Inject(WEBHOOK_QUEUE_PORT)
    private readonly webhookQueue: IWebhookQueuePort,
  ) { }

  /**
   * Dispatch pending outbox events to webhook queue.
   * Runs every 10 seconds.
   */
  @Cron('*/10 * * * * *')
  async handleDispatch(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const events = await this.outboxRepository.findPendingEvents(50);

      if (events.length === 0) {
        return;
      }

      this.logger.log(`Dispatching ${events.length} outbox events to webhook queue`);

      for (const event of events) {
        try {
          // 1. Mark as DISPATCHED in the database so the Cron never picks it up again
          event.markAsDispatched();
          await this.outboxRepository.update(event);

          // 2. Hand it over to BullMQ which will manage the 5 exponential retries natively
          await this.webhookQueue.enqueue(event.id);
          this.logger.debug(`Dispatched event ${event.id} (${event.eventType}) to BullMQ`);
        } catch (error) {
          // If BullMQ fails to even accept the job, we should mark it as failed in the DB
          event.markAsFailed('Failed to insert job into BullMQ');
          await this.outboxRepository.update(event);
          this.logger.error(`Failed to dispatch event ${event.id}`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error in outbox dispatcher', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
