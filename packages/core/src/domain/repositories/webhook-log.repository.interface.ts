import { WebhookLog, WebhookLogProps } from '../entities/webhook-log.entity';

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
   * Find a webhook log by ID.
   */
  findById(id: string): Promise<WebhookLog | null>;

  /**
   * Find logs by webhook config ID.
   */
  findByConfigId(configId: string, limit?: number): Promise<WebhookLog[]>;

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
  countByConfigId(configId: string, delivered: boolean): Promise<number>;
}
