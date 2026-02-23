import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  IAccountRepository,
  Account,
  AccountProps,
} from '@hockpay/core';

/**
 * Infrastructure implementation of IAccountRepository.
 */
@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(account: Account): Promise<void> {
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

  async update(account: Account): Promise<void> {
    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        available: account.available,
        pending: account.pending,
        blocked: account.blocked,
        updatedAt: account.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<Account | null> {
    const prismaAccount = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!prismaAccount) {
      return null;
    }

    return this.toDomain(prismaAccount);
  }

  async findByStoreId(storeId: string): Promise<Account | null> {
    const prismaAccount = await this.prisma.account.findUnique({
      where: { storeId },
    });

    if (!prismaAccount) {
      return null;
    }

    return this.toDomain(prismaAccount);
  }

  async findWithPendingBalance(cutoffDate: Date): Promise<Account[]> {
    // This finds accounts that have confirmed payments ready for release
    // based on the store's settlement days
    const accounts = await this.prisma.$queryRaw<any[]>`
      SELECT DISTINCT a.*
      FROM accounts a
      JOIN stores s ON s.id = a.store_id
      JOIN payments p ON p.store_id = s.id
      WHERE s.is_active = true
        AND s.is_approved = true
        AND p.status = 'CONFIRMED'
        AND p.paid_at <= ${cutoffDate}
    `;

    return accounts.map((a) => this.toDomainFromRaw(a));
  }

  private toDomain(prismaAccount: any): Account {
    const props: AccountProps = {
      id: prismaAccount.id,
      storeId: prismaAccount.storeId,
      available: prismaAccount.available,
      pending: prismaAccount.pending,
      blocked: prismaAccount.blocked,
      currency: prismaAccount.currency,
      updatedAt: prismaAccount.updatedAt,
    };

    return Account.reconstitute(props);
  }

  private toDomainFromRaw(raw: any): Account {
    const props: AccountProps = {
      id: raw.id,
      storeId: raw.store_id,
      available: Number(raw.available),
      pending: Number(raw.pending),
      blocked: Number(raw.blocked),
      currency: raw.currency,
      updatedAt: raw.updated_at,
    };

    return Account.reconstitute(props);
  }
}
