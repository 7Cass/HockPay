import { Account } from '../entities/account.entity';
import { Environment } from '../value-objects/environment.vo';

/**
 * Repository interface for Account aggregate.
 *
 * Provides persistence operations for financial accounts.
 *
 * There is no lookup by store alone: a store has one ledger per environment,
 * and asking for "the store's account" has no answer. Resolving by id keeps
 * working, because an id already pins the environment.
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
   * Find the account of a store in one environment.
   */
  findByStoreIdAndEnvironment(storeId: string, environment: Environment): Promise<Account | null>;

  /**
   * Find the account of a store in one environment and lock it for update
   * within the current transaction.
   */
  findByStoreIdAndEnvironmentForUpdate(
    storeId: string,
    environment: Environment,
  ): Promise<Account | null>;

  /**
   * Find accounts that have pending balance ready for release.
   * Used by the settlement job.
   *
   * @param cutoffDate - Payments confirmed before this date are ready for release
   */
  findWithPendingBalance(cutoffDate: Date): Promise<Account[]>;
}
