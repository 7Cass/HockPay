import { ITransactionRepository } from '../../domain/repositories/transaction.repository.interface';
import { IAccountRepository } from '../../domain/repositories/account.repository.interface';
import { TransactionType, DailyVolume } from '../../domain/entities/transaction.entity';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';

export interface DashboardMetricsDto {
    currentBalance: {
        available: number;
        pending: number;
        blocked: number;
    };
    processing: {
        totalVolume: number; // sum of payment net amounts
        salesCount: number; // count of payments
        averageTicket: number; // totalVolume / salesCount
        feeVolume: number; // total fees paid
    };
    chartData: DailyVolume[];
}

export class GetDashboardMetricsUseCase {
    constructor(
        private readonly transactionRepo: ITransactionRepository,
        private readonly accountRepo: IAccountRepository,
    ) { }

    async execute(
        storeId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<DashboardMetricsDto> {
        // 1. Get current balance
        const account = await this.accountRepo.findByStoreId(storeId);
        if (!account) {
            throw new AccountNotFoundError(storeId);
        }

        // 2. Processing metrics (from transactions marked as PAYMENT_RECEIVED in this period)
        const totalVolume = await this.transactionRepo.sumByTypeAndDateRange(
            account.id,
            TransactionType.PAYMENT_RECEIVED,
            startDate,
            endDate,
        );

        const feeVolume = await this.transactionRepo.sumByTypeAndDateRange(
            account.id,
            TransactionType.FEE_CHARGED,
            startDate,
            endDate,
        );

        // To get the transaction count efficiently, we can use countWithFilters
        const salesCount = await this.transactionRepo.countWithFilters({
            accountId: account.id,
            type: TransactionType.PAYMENT_RECEIVED,
            startDate,
            endDate,
        });

        // 3. Chart Data (aggregation by day for the chart)
        const chartData = await this.transactionRepo.getDailyVolume(account.id, startDate, endDate);

        return {
            currentBalance: {
                available: account.available,
                pending: account.pending,
                blocked: account.blocked,
            },
            processing: {
                totalVolume: totalVolume,
                salesCount: salesCount,
                averageTicket: salesCount > 0 ? Math.round(totalVolume / salesCount) : 0,
                feeVolume: Math.abs(feeVolume),
            },
            chartData,
        };
    }
}
