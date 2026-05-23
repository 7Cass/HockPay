import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IWebhookQueuePort, WebhookJobData } from '@hockpay/core';

/**
 * BullMQ-based implementation of IWebhookQueuePort.
 *
 * Uses the shared BullMQ connection configured in QueueModule.
 */
@Injectable()
export class WebhookQueue implements IWebhookQueuePort, OnModuleDestroy {
  private static readonly QUEUE_NAME = 'webhook-delivery';

  constructor(
    @InjectQueue(WebhookQueue.QUEUE_NAME)
    private readonly queue: Queue<WebhookJobData>,
  ) {}

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
    }
  }

  async enqueue(eventId: string, delay?: number, requestId?: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    await this.queue.add(
      'deliver',
      { eventId, attempt: 1, requestId },
      {
        delay: delay ?? 0,
        jobId: `webhook-${eventId}`,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60000, // Starts at 1min, then 2m, 4m, 8m
        },
      },
    );
  }

  async enqueueRetry(eventId: string, attempt: number): Promise<void> {
    void attempt;
    // Deprecated: BullMQ handles generic backoffs via the `backoff` config directly in enqueue.
    await this.enqueue(eventId);
  }
}
