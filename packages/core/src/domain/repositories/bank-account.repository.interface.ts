import { BankAccount } from '../entities/bank-account.entity';

export interface BankAccountUsage {
  hasWithdrawals: boolean;
  hasActiveWithdrawals: boolean;
  withdrawalCount: number;
  activeWithdrawalCount: number;
}

export interface IBankAccountRepository {
  /**
   * Creates or updates a BankAccount.
   */
  save(bankAccount: BankAccount): Promise<void>;

  /**
   * Finds a BankAccount by its ID.
   */
  findById(id: string): Promise<BankAccount | null>;

  /**
   * Lists all BankAccounts belonging to a specific Store.
   */
  findByStoreId(storeId: string): Promise<BankAccount[]>;

  /**
   * Returns withdrawal usage flags for all BankAccounts belonging to a store.
   */
  findUsageByStoreId(storeId: string): Promise<Record<string, BankAccountUsage>>;

  /**
   * Resets the isDefault flag for all accounts belonging to the store
   * except the specified one.
   */
  clearDefaultFlagExcept(storeId: string, keepDefaultId: string): Promise<void>;

  /**
   * Deletes a BankAccount by ID.
   */
  delete(id: string): Promise<void>;
}
