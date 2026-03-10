import { IBankAccountRepository } from '../../domain/repositories/bank-account.repository.interface';

export class DeleteBankAccountUseCase {
    constructor(private readonly bankAccountRepo: IBankAccountRepository) { }

    async execute(id: string, storeId: string): Promise<void> {
        const bankAccount = await this.bankAccountRepo.findById(id);

        if (!bankAccount) {
            throw new Error('Bank account not found');
        }

        if (bankAccount.storeId !== storeId) {
            throw new Error('Unauthorized access to bank account');
        }

        // TODO: Verify if there are pending/processing withdrawals tied to this account before deleting.
        // For now, if the database has a restrict/cascade rule, Prisma might throw.
        // Given the Prisma Schema: `bankAccount BankAccount @relation(fields: [bankAccountId], references: [id], onDelete: Restrict)`
        // Withdrawals have `onDelete: Restrict`, meaning the DB will block deletion if there are past withdrawals. 
        // This is the correct financial constraint. The caller must handle the Prisma exception if it happens.

        await this.bankAccountRepo.delete(id);
    }
}
