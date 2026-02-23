import { IdempotencyKey } from '../entities/idempotency-key.entity';

/**
 * Repository Interface: IdempotencyKey
 *
 * Defines the contract for persisting idempotency keys.
 * Implementations should use PostgreSQL for durable storage.
 */
export interface IIdempotencyKeyRepository {
  /**
   * Find an idempotency key by its key and store ID.
   *
   * @param key - The idempotency key provided by the client
   * @param storeId - The store ID for isolation
   * @returns The IdempotencyKey entity or null if not found
   */
  findByKeyAndStore(key: string, storeId: string): Promise<IdempotencyKey | null>;

  /**
   * Save a new idempotency key.
   * Should throw if a key with the same key+storeId already exists.
   *
   * @param idempotencyKey - The idempotency key entity to save
   */
  save(idempotencyKey: IdempotencyKey): Promise<void>;

  /**
   * Delete a specific idempotency key by ID.
   *
   * @param id - The idempotency key ID to delete
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all expired idempotency keys.
   * This is a maintenance operation for cleaning up old keys.
   *
   * @returns The number of deleted keys
   */
  deleteExpired(): Promise<number>;
}
