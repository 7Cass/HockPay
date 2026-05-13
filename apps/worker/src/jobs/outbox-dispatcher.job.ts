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
import { createWorkerRequestId } from "../common/request-id";
import { runExclusiveCronJob } from "../common/cron-guard";

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
    await runExclusiveCronJob(OutboxDispatcherJob.name, this.logger, () =>
      this.dispatchEvents(),
    );
  }

  private async dispatchEvents(): Promise<void> {
    try {
      const events = await this.outboxRepository.findDispatchableEvents(50);

      if (events.length === 0) {
        return;
      }

      this.logger.log(
        `Dispatching ${events.length} outbox events to webhook queue`,
      );

      for (const event of events) {
        const requestId =
          event.requestId ?? createWorkerRequestId("outbox-dispatcher", event.id);
        const paymentId =
          typeof event.payload.id === "string" ? event.payload.id : event.aggregateId;
        try {
          // BullMQ must accept the webhook job before the outbox leaves a dispatchable state.
          await this.webhookQueue.enqueue(event.id, undefined, requestId);

          event.markAsDispatched(this.nextDispatchWatchdog());
          await this.outboxRepository.update(event);

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
          event.markAsFailed(
            "Failed to insert webhook job into BullMQ",
            this.nextEnqueueRetry(),
          );
          await this.outboxRepository.update(event);
          this.logger.error(
            `Failed to dispatch webhook event requestId=${requestId} outboxEventId=${event.id} paymentId=${paymentId}`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error("Error in outbox dispatcher", error);
    }
  }

  private nextDispatchWatchdog(): Date {
    return new Date(Date.now() + OutboxDispatcherJob.DISPATCH_WATCHDOG_MS);
  }

  private nextEnqueueRetry(): Date {
    return new Date(Date.now() + OutboxDispatcherJob.ENQUEUE_RETRY_MS);
  }
}
