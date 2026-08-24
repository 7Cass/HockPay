import {
  Transaction,
  TransactionProps,
  TransactionType,
  DailyVolume,
} from '../entities/transaction.entity';

export interface ITransactionFilters {
  accountId: string;
  startDate?: Date;
  endDate?: Date;
  type?: TransactionType;
}

/**
 * Repository interface for Transaction entity.
 *
 * Provides persistence operations for financial transactions.
 */
export interface ITransactionRepository {
  /**
   * Save a new transaction.
   */
  save(transaction: Transaction): Promise<void>;

  /**
   * Find a transaction by ID.
   */
  findById(id: string): Promise<Transaction | null>;

  /**
   * Find all transactions for an account.
   */
  findByAccountId(accountId: string, limit?: number): Promise<Transaction[]>;

  /**
   * Find transactions by reference.
   */
  findByReference(referenceType: string, referenceId: string): Promise<Transaction[]>;

  /**
   * Find transactions by type within a date range.
   */
  findByTypeAndDateRange(
    type: TransactionType,
    startDate: Date,
    endDate: Date,
  ): Promise<Transaction[]>;

  /**
   * Get the latest balance after value for an account.
   * Used to calculate balanceAfter for new transactions.
   */
  getLatestBalance(accountId: string): Promise<number>;

  /**
   * Sum transactions by type for an account within a date range.
   */
  sumByTypeAndDateRange(
    accountId: string,
    type: TransactionType,
    startDate: Date,
    endDate: Date,
  ): Promise<number>;

  /**
   * Find transactions with arbitrary filters and pagination.
   */
  findWithFilters(
    filters: ITransactionFilters,
    page: number,
    limit: number,
  ): Promise<Transaction[]>;

  /**
   * Count transactions matching filters.
   */
  /**
   * Count transactions matching filters.
   */
  countWithFilters(filters: ITransactionFilters): Promise<number>;

  /**
   * Aggregate transaction volume by day.
   */
  getDailyVolume(accountId: string, startDate: Date, endDate: Date): Promise<DailyVolume[]>;
}
