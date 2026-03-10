import { IBankAccountRepository } from '../../domain/repositories/bank-account.repository.interface';
import { BankAccount } from '../../domain/entities/bank-account.entity';

export class ListBankAccountsUseCase {
    constructor(private readonly bankAccountRepo: IBankAccountRepository) { }

    async execute(storeId: string): Promise<BankAccount[]> {
        return this.bankAccountRepo.findByStoreId(storeId);
    }
}
