import { IBankAccountRepository } from '../../domain/repositories/bank-account.repository.interface';
import { BankAccountInUseError } from '../../domain/errors/bank-account-in-use.error';
import { BankAccountNotFoundError } from '../../domain/errors/bank-account-not-found.error';
import { UnauthorizedBankAccountAccessError } from '../../domain/errors/unauthorized-bank-account-access.error';

export class DeleteBankAccountUseCase {
  constructor(private readonly bankAccountRepo: IBankAccountRepository) {}

  async execute(id: string, storeId: string): Promise<void> {
    const bankAccount = await this.bankAccountRepo.findById(id);

    if (!bankAccount) {
      throw new BankAccountNotFoundError(id);
    }

    if (bankAccount.storeId !== storeId) {
      throw new UnauthorizedBankAccountAccessError();
    }

    const usageByAccountId = await this.bankAccountRepo.findUsageByStoreId(storeId);
    if (usageByAccountId[id]?.hasWithdrawals) {
      throw new BankAccountInUseError(id);
    }

    await this.bankAccountRepo.delete(id);
  }
}
