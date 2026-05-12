import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { IExpirationQueuePort } from '@hockpay/core';

/**
 * BullMQ-based implementation of IExpirationQueuePort.
 *
 * Handles scheduling and cancellation of payment expiration jobs.
 * This queue is shared with the API - API schedules, Worker processes.
 */
@Injectable()
export class ExpirationQueue implements IExpirationQueuePort, OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;

  private static readonly QUEUE_NAME = 'payment-expiration';

  onModuleInit() {
    this.queue = new Queue(ExpirationQueue.QUEUE_NAME, {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    });
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
    }
  }

  async scheduleExpiration(paymentId: string, expiresAt: Date, requestId?: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

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
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const jobId = `expire-${paymentId}`;
    const job = await this.queue.getJob(jobId);

    if (job) {
      await job.remove();
    }
  }
}
