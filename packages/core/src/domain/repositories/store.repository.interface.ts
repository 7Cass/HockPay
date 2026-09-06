import { Store } from '../entities/store.entity';
import { StoreLiveStatus } from '../value-objects/store-live-status.vo';

/**
 * Interface for Store Repository.
 *
 * This interface is defined in the domain layer and represents the contract
 * that any infrastructure implementation must follow.
 */
export interface IStoreRepository {
  /**
   * Save a new store to the repository.
   */
  save(store: Store): Promise<void>;

  /**
   * Find a store by ID.
   * Returns null if not found.
   */
  findById(id: string): Promise<Store | null>;

  /**
   * Find a store by ID and lock it for update.
   *
   * The desk's decision reads the state, changes it and writes the audit line
   * in one transaction. Without the lock, two operators deciding at the same
   * moment would produce two trail lines describing the same `before`.
   */
  findByIdForUpdate(id: string): Promise<Store | null>;

  /**
   * Find a store by ID and merchant ID.
   * This ensures the store belongs to the merchant.
   * Returns null if not found or doesn't belong to the merchant.
   */
  findByIdAndMerchantId(id: string, merchantId: string): Promise<Store | null>;

  /**
   * Find a store by slug.
   * Returns null if not found.
   */
  findBySlug(slug: string): Promise<Store | null>;

  /**
   * Find all stores for a merchant.
   */
  findByMerchantId(merchantId: string): Promise<Store[]>;

  /**
   * Update a store.
   */
  update(store: Store): Promise<void>;

  /**
   * Delete a store by ID.
   */
  delete(id: string): Promise<void>;

  listActive(): Promise<Store[]>;

  /**
   * The enablement queue, newest first.
   *
   * Reads only what a decision needs. Anything more is cross-merchant
   * investigation, which is a slice of its own.
   */
  listByLiveStatus(params: {
    liveStatus?: StoreLiveStatus;
    limit: number;
    offset: number;
  }): Promise<Store[]>;
}
