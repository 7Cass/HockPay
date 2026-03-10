import {
    IBankAccountRepository,
    BankAccount as DomainBankAccount,
    PixKeyType as DomainPixKeyType
} from '@hockpay/core';
import { PrismaClient, Prisma, BankAccount as PrismaBankAccount } from '@hockpay/database';

export class BankAccountRepository implements IBankAccountRepository {
    constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) { }

    async save(bankAccount: DomainBankAccount): Promise<void> {
        await this.prisma.bankAccount.upsert({
            where: { id: bankAccount.id },
            update: {
                storeId: bankAccount.storeId,
                pixKey: bankAccount.pixKey,
                pixKeyType: bankAccount.pixKeyType as any,
                holderName: bankAccount.holderName,
                holderDocument: bankAccount.holderDocument,
                isDefault: bankAccount.isDefault,
                isVerified: bankAccount.isVerified,
                updatedAt: bankAccount.updatedAt,
            },
            create: {
                id: bankAccount.id,
                storeId: bankAccount.storeId,
                pixKey: bankAccount.pixKey,
                pixKeyType: bankAccount.pixKeyType as any,
                holderName: bankAccount.holderName,
                holderDocument: bankAccount.holderDocument,
                isDefault: bankAccount.isDefault,
                isVerified: bankAccount.isVerified,
                createdAt: bankAccount.createdAt,
                updatedAt: bankAccount.updatedAt,
            },
        });
    }

    async findById(id: string): Promise<DomainBankAccount | null> {
        const prismaBankAccount = await this.prisma.bankAccount.findUnique({
            where: { id },
        });

        if (!prismaBankAccount) {
            return null;
        }

        return this.toDomain(prismaBankAccount);
    }

    async findByStoreId(storeId: string): Promise<DomainBankAccount[]> {
        const accounts = await this.prisma.bankAccount.findMany({
            where: { storeId },
            orderBy: { createdAt: 'desc' },
        });

        return accounts.map(this.toDomain);
    }

    async clearDefaultFlagExcept(storeId: string, keepDefaultId: string): Promise<void> {
        await this.prisma.bankAccount.updateMany({
            where: {
                storeId,
                id: { not: keepDefaultId },
                isDefault: true,
            },
            data: {
                isDefault: false,
            },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.bankAccount.delete({
            where: { id },
        });
    }

    private toDomain(prismaBankAccount: PrismaBankAccount): DomainBankAccount {
        return DomainBankAccount.reconstitute({
            id: prismaBankAccount.id,
            storeId: prismaBankAccount.storeId,
            pixKey: prismaBankAccount.pixKey,
            pixKeyType: prismaBankAccount.pixKeyType as DomainPixKeyType,
            holderName: prismaBankAccount.holderName,
            holderDocument: prismaBankAccount.holderDocument,
            isDefault: prismaBankAccount.isDefault,
            isVerified: prismaBankAccount.isVerified,
            createdAt: prismaBankAccount.createdAt,
            updatedAt: prismaBankAccount.updatedAt,
        });
    }
}
