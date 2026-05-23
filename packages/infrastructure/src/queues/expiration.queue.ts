import { Queue } from "bullmq";
import { IExpirationQueuePort } from "@hockpay/core";
import { RedisConnectionOptions } from "../config/redis-env";

export type ExpirationQueueConnectionOptions = RedisConnectionOptions;

/**
 * BullMQ-based implementation of IExpirationQueuePort.
 *
 * API schedules expiration jobs and Worker processes the same queue.
 */
export class ExpirationQueue implements IExpirationQueuePort {
  private static readonly QUEUE_NAME = "payment-expiration";

  private readonly queue: Queue;

  constructor(connection: ExpirationQueueConnectionOptions) {
    this.queue = new Queue(ExpirationQueue.QUEUE_NAME, {
      connection,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  async scheduleExpiration(
    paymentId: string,
    expiresAt: Date,
    requestId?: string,
  ): Promise<void> {
    const delay = Math.max(0, expiresAt.getTime() - Date.now());

    await this.queue.add(
      "expire",
      { paymentId, requestId },
      {
        delay,
        jobId: `expire-${paymentId}`,
        removeOnComplete: true,
        removeOnFail: {
          age: 7 * 24 * 60 * 60,
        },
      },
    );
  }

  async cancelExpiration(paymentId: string): Promise<void> {
    const job = await this.queue.getJob(`expire-${paymentId}`);

    if (job) {
      await job.remove();
    }
  }
}
