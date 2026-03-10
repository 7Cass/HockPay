import {
    IAccountRepository,
    Account as DomainAccount,
} from '@hockpay/core';
import { PrismaClient, Account as PrismaAccount, Prisma } from '@hockpay/database';

/**
 * Shared implementation of IAccountRepository using Prisma.
 */
export class AccountRepository implements IAccountRepository {
    constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) { }

    async save(account: DomainAccount): Promise<void> {
        await this.prisma.account.create({
            data: {
                id: account.id,
                storeId: account.storeId,
                available: account.available,
                pending: account.pending,
                blocked: account.blocked,
                currency: account.currency,
                updatedAt: account.updatedAt,
            },
        });
    }

    async update(account: DomainAccount): Promise<void> {
        await this.prisma.account.update({
            where: { id: account.id },
            data: {
                available: account.available,
                pending: account.pending,
                blocked: account.blocked,
                currency: account.currency,
                updatedAt: account.updatedAt,
            },
        });
    }

    async findById(id: string): Promise<DomainAccount | null> {
        const prismaAccount = await this.prisma.account.findUnique({
            where: { id },
        });

        if (!prismaAccount) {
            return null;
        }

        return this.toDomain(prismaAccount);
    }

    async findByStoreId(storeId: string): Promise<DomainAccount | null> {
        const prismaAccount = await this.prisma.account.findUnique({
            where: { storeId },
        });

        if (!prismaAccount) {
            return null;
        }

        return this.toDomain(prismaAccount);
    }

    async findWithPendingBalance(cutoffDate: Date): Promise<DomainAccount[]> {
        // This is a naive implementation. In a real scenario, this logic
        // might live primarily in the settlement job pushing balances.
        // However, meeting the repository interface signature:
        const prismaAccounts = await this.prisma.account.findMany({
            where: {
                pending: { gt: 0 },
                // Often depends on a 'releasedAt' check against Payments, 
                // but the interface forces us to check here.
            },
        });

        return prismaAccounts.map(this.toDomain);
    }

    private toDomain(prismaAccount: PrismaAccount): DomainAccount {
        return DomainAccount.reconstitute({
            id: prismaAccount.id,
            storeId: prismaAccount.storeId,
            available: prismaAccount.available,
            pending: prismaAccount.pending,
            blocked: prismaAccount.blocked,
            currency: prismaAccount.currency,
            updatedAt: prismaAccount.updatedAt,
        });
    }
}
