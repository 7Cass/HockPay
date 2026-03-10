import { ITransactionRepository, ITransactionFilters } from '../../domain/repositories/transaction.repository.interface';
import { IAccountRepository } from '../../domain/repositories/account.repository.interface';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';
import { TransactionObject, TransactionType } from '../../domain/entities/transaction.entity';

export interface IListTransactionsInput {
    storeId: string;
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
    type?: TransactionType;
}

export interface IListTransactionsOutput {
    data: TransactionObject[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * Use Case: List Transactions
 *
 * This use case handles fetching the transaction ledger for a store.
 * Allows pagination and filtering by date range and transaction type.
 *
 * Business rules:
 * - Maps the storeId to an accountId first.
 * - Enforces store existence checking via account presence.
 */
export class ListTransactionsUseCase {
    constructor(
        private readonly transactionRepository: ITransactionRepository,
        private readonly accountRepository: IAccountRepository,
    ) { }

    async execute(input: IListTransactionsInput): Promise<IListTransactionsOutput> {
        const page = input.page && input.page > 0 ? input.page : 1;
        const limit = input.limit && input.limit > 0 ? input.limit : 20;

        const account = await this.accountRepository.findByStoreId(input.storeId);
        if (!account) {
            throw new AccountNotFoundError(input.storeId);
        }

        const filters: ITransactionFilters = {
            accountId: account.id,
            startDate: input.startDate,
            endDate: input.endDate,
            type: input.type,
        };

        const [transactions, total] = await Promise.all([
            this.transactionRepository.findWithFilters(filters, page, limit),
            this.transactionRepository.countWithFilters(filters),
        ]);

        return {
            data: transactions.map(tx => tx.toObject()),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        };
    }
}
