import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  IWebhookQueuePort,
  WebhookJobData,
} from '@hockpay/core';

/**
 * BullMQ-based implementation of IWebhookQueuePort.
 */
@Injectable()
export class WebhookQueue implements IWebhookQueuePort, OnModuleInit, OnModuleDestroy {
  private queue: Queue<WebhookJobData> | null = null;

  private static readonly QUEUE_NAME = 'webhook-delivery';

  onModuleInit() {
    this.queue = new Queue<WebhookJobData>(WebhookQueue.QUEUE_NAME, {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
      defaultJobOptions: {
        removeOnComplete: {
          count: 1000,
          age: 24 * 60 * 60, // 24 hours
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // 7 days
        },
      },
    });
  }

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
