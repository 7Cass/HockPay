import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { IExpirationQueuePort } from '@hockpay/core';

/**
 * BullMQ-based implementation of IExpirationQueuePort.
 *
 * Handles scheduling and cancellation of payment expiration jobs.
 */
@Injectable()
export class ExpirationQueue implements IExpirationQueuePort, OnModuleInit {
  private queue: Queue;

  private static readonly QUEUE_NAME = 'payment-expiration';

  onModuleInit() {
    this.queue = new Queue(ExpirationQueue.QUEUE_NAME, {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    });
  }

  async scheduleExpiration(paymentId: string, expiresAt: Date, requestId?: string): Promise<void> {
    const delay = Math.max(0, expiresAt.getTime() - Date.now());

    await this.queue.add(
      'expire',
      { paymentId, requestId },
      {
        delay,
        jobId: `expire-${paymentId}`,
        removeOnComplete: true,
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // 7 days in seconds
        },
      },
    );
  }

  async cancelExpiration(paymentId: string): Promise<void> {
    const jobId = `expire-${paymentId}`;
    const job = await this.queue.getJob(jobId);

    if (job) {
      await job.remove();
    }
  }
}
