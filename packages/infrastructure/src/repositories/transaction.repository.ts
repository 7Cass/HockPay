import {
    ITransactionRepository,
    Transaction as DomainTransaction,
    TransactionType,
    ITransactionFilters,
    DailyVolume,
} from '@hockpay/core';
import { PrismaClient, Prisma, Transaction as PrismaTransaction } from '@hockpay/database';

/**
 * Shared implementation of ITransactionRepository using Prisma.
 */
export class TransactionRepository implements ITransactionRepository {
    constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) { }

    async save(transaction: DomainTransaction): Promise<void> {
        await this.prisma.transaction.create({
            data: {
                id: transaction.id,
                accountId: transaction.accountId,
                type: transaction.type as any, // Enum mapping
                amount: transaction.amount,
                fee: transaction.fee,
                netAmount: transaction.netAmount,
                balanceAfter: transaction.balanceAfter,
                referenceType: transaction.referenceType,
                referenceId: transaction.referenceId,
                description: transaction.description,
                createdAt: transaction.createdAt,
                updatedAt: transaction.updatedAt,
            },
        });
    }

    async findById(id: string): Promise<DomainTransaction | null> {
        const prismaTransaction = await this.prisma.transaction.findUnique({
            where: { id },
        });

        if (!prismaTransaction) {
            return null;
        }

        return this.toDomain(prismaTransaction);
    }

    async findByAccountId(
        accountId: string,
        limit?: number,
    ): Promise<DomainTransaction[]> {
        const prismaTransactions = await this.prisma.transaction.findMany({
            where: { accountId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return prismaTransactions.map(this.toDomain);
    }

    async findByReference(
        referenceType: string,
        referenceId: string,
    ): Promise<DomainTransaction[]> {
        const prismaTransactions = await this.prisma.transaction.findMany({
            where: {
                referenceType,
                referenceId,
            },
            orderBy: { createdAt: 'desc' },
        });

        return prismaTransactions.map(this.toDomain);
    }

    async findByTypeAndDateRange(
        type: TransactionType,
        startDate: Date,
        endDate: Date,
    ): Promise<DomainTransaction[]> {
        const prismaTransactions = await this.prisma.transaction.findMany({
            where: {
                type: type as any,
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return prismaTransactions.map(this.toDomain);
    }

    async getLatestBalance(accountId: string): Promise<number> {
        const latestTransaction = await this.prisma.transaction.findFirst({
            where: { accountId },
            orderBy: { createdAt: 'desc' },
            select: { balanceAfter: true },
        });

        return latestTransaction?.balanceAfter ?? 0;
    }

    async sumByTypeAndDateRange(
        accountId: string,
        type: TransactionType,
        startDate: Date,
        endDate: Date,
    ): Promise<number> {
        const aggregation = await this.prisma.transaction.aggregate({
            where: {
                accountId,
                type: type as any,
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            _sum: {
                amount: true,
            },
        });

        return aggregation._sum.amount ?? 0;
    }

    private toDomain(prismaTransaction: PrismaTransaction): DomainTransaction {
        return DomainTransaction.reconstitute({
            id: prismaTransaction.id,
            accountId: prismaTransaction.accountId,
            type: prismaTransaction.type as TransactionType,
            amount: prismaTransaction.amount,
            fee: prismaTransaction.fee,
            netAmount: prismaTransaction.netAmount,
            balanceAfter: prismaTransaction.balanceAfter,
            referenceType: prismaTransaction.referenceType || undefined,
            referenceId: prismaTransaction.referenceId || undefined,
            description: prismaTransaction.description || undefined,
            createdAt: prismaTransaction.createdAt,
            updatedAt: prismaTransaction.updatedAt,
        });
    }

    async findWithFilters(filters: ITransactionFilters, page: number, limit: number): Promise<DomainTransaction[]> {
        const skip = (page - 1) * limit;
        const prismaTransactions = await this.prisma.transaction.findMany({
            where: this.buildPrismaWhere(filters),
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        });
        return prismaTransactions.map(this.toDomain);
    }

    async countWithFilters(filters: ITransactionFilters): Promise<number> {
        return this.prisma.transaction.count({
            where: this.buildPrismaWhere(filters),
        });
    }

    private buildPrismaWhere(filters: ITransactionFilters): Prisma.TransactionWhereInput {
        const where: Prisma.TransactionWhereInput = { accountId: filters.accountId };
        if (filters.type) {
            where.type = filters.type as any;
        }
        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) where.createdAt.gte = filters.startDate;
            if (filters.endDate) where.createdAt.lte = filters.endDate;
        }
        return where;
    }

    async getDailyVolume(accountId: string, startDate: Date, endDate: Date): Promise<DailyVolume[]> {
        const result = await this.prisma.$queryRaw<
            Array<{ date: string; volume: number; count: number }>
        >`
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM-DD') as date,
                CAST(SUM(net_amount) AS INTEGER) as volume,
                CAST(COUNT(*) AS INTEGER) as count
            FROM transactions
            WHERE account_id = ${accountId}
              AND created_at >= ${startDate}
              AND created_at <= ${endDate}
            GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
            ORDER BY TO_CHAR(created_at, 'YYYY-MM-DD') ASC
        `;

        return result.map((row) => ({
            date: row.date,
            volume: Number(row.volume),
            count: Number(row.count),
        }));
    }
}
