import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  IWebhookQueuePort,
  WebhookJobData,
} from '@hockpay/core';

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

  async enqueue(eventId: string, delay?: number): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    await this.queue.add(
      'deliver',
      { eventId, attempt: 1 },
      {
        delay: delay ?? 0,
        jobId: `webhook-${eventId}`,
      },
    );
  }

  async enqueueRetry(eventId: string, attempt: number): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    // Exponential backoff: 1min, 5min, 30min, 2h
    const delays = [0, 60000, 300000, 1800000, 7200000];
    const index = Math.min(attempt - 1, delays.length - 1);
    const delay = delays[index];

    await this.queue.add(
      'deliver',
      { eventId, attempt },
      {
        delay,
        jobId: `webhook-${eventId}-retry-${attempt}`,
      },
    );
  }
}
