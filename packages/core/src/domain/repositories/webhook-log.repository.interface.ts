import { WebhookLog, WebhookLogProps } from '../entities/webhook-log.entity';

export type WebhookLogStatus = 'pending' | 'delivered' | 'failed';

export interface FindWebhookLogsByConfigIdOptions {
  page?: number;
  limit?: number;
  status?: WebhookLogStatus;
}

/**
 * Repository interface for WebhookLog entity.
 *
 * Provides persistence operations for webhook delivery logs.
 */
export interface IWebhookLogRepository {
  /**
   * Save a new webhook log.
   */
  save(log: WebhookLog): Promise<void>;

  /**
   * Update an existing webhook log.
   */
  update(log: WebhookLog): Promise<void>;

  /**
   * Create or update the canonical delivery row for an outbox/config pair.
   */
  upsertDelivery(log: WebhookLog): Promise<void>;

  /**
   * Find a webhook log by ID.
   */
  findById(id: string): Promise<WebhookLog | null>;

  /**
   * Find the canonical delivery row for an outbox/config pair.
   */
  findByConfigAndOutboxEvent(
    configId: string,
    outboxEventId: string,
  ): Promise<WebhookLog | null>;

  /**
   * Find all delivery rows for an outbox event.
   */
  findByOutboxEventId(outboxEventId: string): Promise<WebhookLog[]>;

  /**
   * Find logs by webhook config ID.
   */
  findByConfigId(
    configId: string,
    options?: FindWebhookLogsByConfigIdOptions,
  ): Promise<WebhookLog[]>;

  /**
   * Find logs by payment ID.
   */
  findByPaymentId(paymentId: string): Promise<WebhookLog[]>;

  /**
   * Find failed logs that need retry.
   * Returns logs where deliveredAt is null and nextRetryAt <= now.
   */
  findFailedPendingRetry(limit: number): Promise<WebhookLog[]>;

  /**
   * Delete old logs (cleanup).
   *
   * @param olderThanDays - Delete logs older than this many days
   */
  deleteOldLogs(olderThanDays: number): Promise<number>;

  /**
   * Count logs by config ID and delivery status.
   */
  countByConfigId(configId: string, status?: WebhookLogStatus): Promise<number>;

  /**
   * Mark non-delivered delivery rows for an outbox event as terminal failures.
   */
  markOutboxDeliveriesFinalFailure(
    outboxEventId: string,
    error: string,
    attemptsMade?: number,
  ): Promise<number>;
}
