import { IAccountRepository, Account as DomainAccount, Environment } from '@hockpay/core';
import { PrismaClient, Account as PrismaAccount, Prisma } from '@hockpay/database';
import { utcTimestamp } from '../sql/utc-timestamp';

type AccountRow = {
  id: string;
  storeId: string;
  environment: Environment;
  available: number;
  pending: number;
  blocked: number;
  currency: string;
  updatedAt: Date;
};

/**
 * Shared implementation of IAccountRepository using Prisma.
 */
export class AccountRepository implements IAccountRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async save(account: DomainAccount): Promise<void> {
    await this.prisma.account.create({
      data: {
        id: account.id,
        storeId: account.storeId,
        environment: account.environment,
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

  async findByIdForUpdate(id: string): Promise<DomainAccount | null> {
    const rows = await this.prisma.$queryRaw<AccountRow[]>`
      SELECT
        id,
        store_id AS "storeId",
        environment,
        available,
        pending,
        blocked,
        currency,
        updated_at AS "updatedAt"
      FROM accounts
      WHERE id = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.toDomain(row) : null;
  }

  async findByStoreIdAndEnvironment(
    storeId: string,
    environment: Environment,
  ): Promise<DomainAccount | null> {
    const prismaAccount = await this.prisma.account.findUnique({
      where: { storeId_environment: { storeId, environment } },
    });

    if (!prismaAccount) {
      return null;
    }

    return this.toDomain(prismaAccount);
  }

  async findByStoreIdAndEnvironmentForUpdate(
    storeId: string,
    environment: Environment,
  ): Promise<DomainAccount | null> {
    const rows = await this.prisma.$queryRaw<AccountRow[]>`
      SELECT
        id,
        store_id AS "storeId",
        environment,
        available,
        pending,
        blocked,
        currency,
        updated_at AS "updatedAt"
      FROM accounts
      WHERE store_id = ${storeId}
        AND environment = ${environment}::"Environment"
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.toDomain(row) : null;
  }

  async findWithPendingBalance(cutoffDate: Date): Promise<DomainAccount[]> {
    const prismaAccounts = await this.prisma.$queryRaw<any[]>`
            SELECT DISTINCT a.*
            FROM accounts a
            JOIN stores s ON s.id = a.store_id
            JOIN payments p ON p.store_id = s.id
            WHERE s.is_active = true
              AND s.is_approved = true
              AND p.status = 'CONFIRMED'
              AND p.paid_at <= ${utcTimestamp(cutoffDate)}
        `;

    return prismaAccounts.map((account) => this.toDomainFromRaw(account));
  }

  private toDomain(prismaAccount: PrismaAccount): DomainAccount {
    return DomainAccount.reconstitute({
      id: prismaAccount.id,
      storeId: prismaAccount.storeId,
      environment: prismaAccount.environment as Environment,
      available: prismaAccount.available,
      pending: prismaAccount.pending,
      blocked: prismaAccount.blocked,
      currency: prismaAccount.currency,
      updatedAt: prismaAccount.updatedAt,
    });
  }

  private toDomainFromRaw(raw: any): DomainAccount {
    return DomainAccount.reconstitute({
      id: raw.id,
      storeId: raw.store_id,
      environment: raw.environment as Environment,
      available: Number(raw.available),
      pending: Number(raw.pending),
      blocked: Number(raw.blocked),
      currency: raw.currency,
      updatedAt: raw.updated_at,
    });
  }
}
