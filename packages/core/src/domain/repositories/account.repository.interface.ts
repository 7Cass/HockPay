import { Account, AccountProps } from '../entities/account.entity';

/**
 * Repository interface for Account aggregate.
 *
 * Provides persistence operations for financial accounts.
 */
export interface IAccountRepository {
  /**
   * Save a new account.
   */
  save(account: Account): Promise<void>;

  /**
   * Update an existing account.
   */
  update(account: Account): Promise<void>;

  /**
   * Find an account by ID.
   */
  findById(id: string): Promise<Account | null>;

  /**
   * Find an account by ID and lock it for update within the current transaction.
   */
  findByIdForUpdate(id: string): Promise<Account | null>;

  /**
   * Find an account by store ID.
   */
  findByStoreId(storeId: string): Promise<Account | null>;

  /**
   * Find an account by store ID and lock it for update within the current transaction.
   */
  findByStoreIdForUpdate(storeId: string): Promise<Account | null>;

  /**
   * Find accounts that have pending balance ready for release.
   * Used by the settlement job.
   *
   * @param cutoffDate - Payments confirmed before this date are ready for release
   */
  findWithPendingBalance(cutoffDate: Date): Promise<Account[]>;
}
