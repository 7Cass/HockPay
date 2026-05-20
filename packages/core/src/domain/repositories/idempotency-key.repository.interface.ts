import {
  IdempotencyKey,
  ReserveIdempotencyKeyProps,
} from '../entities/idempotency-key.entity';

export enum IdempotencyReservationStatus {
  RESERVED = 'RESERVED',
  REPLAY = 'REPLAY',
  CONFLICT = 'CONFLICT',
  IN_PROGRESS = 'IN_PROGRESS',
}

export type IdempotencyReservation =
  | {
      status: IdempotencyReservationStatus.RESERVED;
      key: IdempotencyKey;
    }
  | {
      status: IdempotencyReservationStatus.REPLAY;
      key: IdempotencyKey;
    }
  | {
      status: IdempotencyReservationStatus.CONFLICT;
      key: IdempotencyKey;
    }
  | {
      status: IdempotencyReservationStatus.IN_PROGRESS;
      key: IdempotencyKey;
    };

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

  findCompleted(key: string, storeId: string): Promise<IdempotencyKey | null>;

  reserve(input: ReserveIdempotencyKeyProps): Promise<IdempotencyReservation>;

  complete(
    id: string,
    responseBody: Record<string, unknown>,
    responseStatus: number,
  ): Promise<IdempotencyKey>;

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

  deleteExpiredForKey(key: string, storeId: string): Promise<number>;
}
