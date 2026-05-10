import { Injectable, Logger, Inject } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  IAlertQueuePort,
  IWebhookQueuePort,
  IOutboxRepository,
} from "@hockpay/core";
import {
  ALERT_QUEUE_PORT,
  WEBHOOK_QUEUE_PORT,
} from "../modules/queue/queue.module";

/**
 * Outbox Dispatcher Job
 *
 * Polls pending outbox events and dispatches them to the webhook queue.
 * Runs every 10 seconds for low latency webhook delivery.
 */
@Injectable()
export class OutboxDispatcherJob {
  private static readonly DISPATCH_WATCHDOG_MS = 45 * 60 * 1000;
  private static readonly ENQUEUE_RETRY_MS = 60 * 1000;

  private readonly logger = new Logger(OutboxDispatcherJob.name);
  private isProcessing = false;

  constructor(
    @Inject("IOutboxRepository")
    private readonly outboxRepository: IOutboxRepository,
    @Inject(WEBHOOK_QUEUE_PORT)
    private readonly webhookQueue: IWebhookQueuePort,
    @Inject(ALERT_QUEUE_PORT)
    private readonly alertQueue: IAlertQueuePort,
  ) {}

  /**
   * Dispatch pending outbox events to webhook queue.
   * Runs every 10 seconds.
   */
  @Cron("*/10 * * * * *")
  async handleDispatch(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const events = await this.outboxRepository.findDispatchableEvents(50);

      if (events.length === 0) {
        return;
      }

      this.logger.log(
        `Dispatching ${events.length} outbox events to webhook queue`,
      );

      for (const event of events) {
        try {
          // BullMQ must accept the webhook job before the outbox leaves a dispatchable state.
          await this.webhookQueue.enqueue(event.id);

          event.markAsDispatched(this.nextDispatchWatchdog());
          await this.outboxRepository.update(event);

          try {
            await this.alertQueue.enqueue(event.id);
          } catch (error) {
            this.logger.warn(
              `Failed to enqueue alert delivery for event ${event.id}`,
              error,
            );
          }

          this.logger.debug(
            `Dispatched event ${event.id} (${event.eventType}) to BullMQ`,
          );
        } catch (error) {
          event.markAsFailed(
            "Failed to insert webhook job into BullMQ",
            this.nextEnqueueRetry(),
          );
          await this.outboxRepository.update(event);
          this.logger.error(`Failed to dispatch event ${event.id}`, error);
        }
      }
    } catch (error) {
      this.logger.error("Error in outbox dispatcher", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private nextDispatchWatchdog(): Date {
    return new Date(Date.now() + OutboxDispatcherJob.DISPATCH_WATCHDOG_MS);
  }

  private nextEnqueueRetry(): Date {
    return new Date(Date.now() + OutboxDispatcherJob.ENQUEUE_RETRY_MS);
  }
}
