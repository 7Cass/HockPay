import { BankAccountNotFoundError } from '../../domain/errors/bank-account-not-found.error';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export class SetDefaultBankAccountUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(id: string, storeId: string): Promise<void> {
    await this.unitOfWork.execute(async (repos) => {
      const bankAccount = await repos.bankAccountRepository.findById(id);
      if (!bankAccount) {
        throw new BankAccountNotFoundError(id);
      }
      if (bankAccount.storeId !== storeId) {
        throw new BankAccountNotFoundError(id);
      }

      bankAccount.markAsDefault();
      await repos.bankAccountRepository.clearDefaultFlagExcept(storeId, id);
      await repos.bankAccountRepository.save(bankAccount);
    });
  }
}
