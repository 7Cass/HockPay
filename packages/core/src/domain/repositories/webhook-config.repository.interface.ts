import { WebhookConfig } from '../entities/webhook-config.entity';

/**
 * Repository interface for WebhookConfig aggregate.
 *
 * Provides persistence operations for webhook configurations.
 */
export interface IWebhookConfigRepository {
  /**
   * Save a new webhook config.
   */
  save(config: WebhookConfig): Promise<void>;

  /**
   * Update an existing webhook config.
   */
  update(config: WebhookConfig): Promise<void>;

  /**
   * Find a webhook config by ID.
   */
  findById(id: string): Promise<WebhookConfig | null>;

  /**
   * Find all webhook configs for a store.
   */
  findByStoreId(storeId: string): Promise<WebhookConfig[]>;

  /**
   * Find active webhook configs that should receive a specific event.
   *
   * @param storeId - The store ID
   * @param eventType - The event type to match
   */
  findActiveForEvent(storeId: string, eventType: string): Promise<WebhookConfig[]>;

  /**
   * Delete a webhook config.
   */
  delete(id: string): Promise<void>;
}
