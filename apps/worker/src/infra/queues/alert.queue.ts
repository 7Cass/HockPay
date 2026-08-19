import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AlertJobData, IAlertQueuePort } from '@hockpay/core';

@Injectable()
export class AlertQueue implements IAlertQueuePort, OnModuleDestroy {
  private static readonly QUEUE_NAME = 'alert-delivery';

  constructor(
    @InjectQueue(AlertQueue.QUEUE_NAME)
    private readonly queue: Queue<AlertJobData>,
  ) {}

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
    }
  }

  async enqueue(eventId: string, delay?: number, requestId?: string): Promise<void> {
    await this.queue.add(
      'deliver',
      { eventId, requestId },
      {
        delay: delay ?? 0,
        jobId: `alert-${eventId}`,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
      },
    );
  }
}
