import { Store } from '../entities/store.entity';

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

  listActiveApproved(): Promise<Store[]>;
}
