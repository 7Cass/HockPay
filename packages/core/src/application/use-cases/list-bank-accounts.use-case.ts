import { IBankAccountRepository } from '../../domain/repositories/bank-account.repository.interface';
import { BankAccount } from '../../domain/entities/bank-account.entity';

export interface BankAccountWithUsage {
  bankAccount: BankAccount;
  hasWithdrawals: boolean;
  hasActiveWithdrawals: boolean;
  withdrawalCount: number;
  activeWithdrawalCount: number;
}

export class ListBankAccountsUseCase {
  constructor(private readonly bankAccountRepo: IBankAccountRepository) {}

  async execute(storeId: string): Promise<BankAccountWithUsage[]> {
    const [accounts, usageByAccountId] = await Promise.all([
      this.bankAccountRepo.findByStoreId(storeId),
      this.bankAccountRepo.findUsageByStoreId(storeId),
    ]);

    return accounts.map((bankAccount) => {
      const usage = usageByAccountId[bankAccount.id];
      return {
        bankAccount,
        hasWithdrawals: usage?.hasWithdrawals ?? false,
        hasActiveWithdrawals: usage?.hasActiveWithdrawals ?? false,
        withdrawalCount: usage?.withdrawalCount ?? 0,
        activeWithdrawalCount: usage?.activeWithdrawalCount ?? 0,
      };
    });
  }
}
