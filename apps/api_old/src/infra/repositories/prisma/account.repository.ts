import { Injectable } from '@nestjs/common';
import { Account as AccountEntity } from '@hockpay/database';
import { Account } from '../../../domain/entities/account.entity';
import { PrismaService } from '../../database/prisma.service';

/**
 * Implementação do AccountRepository usando Prisma
 */
@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Account | null> {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      return null;
    }

    return this.toDomain(account);
  }

  async findByStoreId(storeId: string): Promise<Account | null> {
    const account = await this.prisma.account.findUnique({
      where: { storeId },
    });

    if (!account) {
      return null;
    }

    return this.toDomain(account);
  }

  async save(account: Account): Promise<Account> {
    const data = account.toPersistence();

    const updated = await this.prisma.account.update({
      where: { id: account.id },
      data: {
        available: data.available,
        pending: data.pending,
        blocked: data.blocked,
        updatedAt: new Date(),
      },
    });

    return this.toDomain(updated);
  }

  async create(account: Account): Promise<Account> {
    const data = account.toPersistence();

    const created = await this.prisma.account.create({
      data,
    });

    return this.toDomain(created);
  }

  async findOrCreate(storeId: string): Promise<Account> {
    const existing = await this.findByStoreId(storeId);

    if (existing) {
      return existing;
    }

    const newAccount = Account.create({
      id: crypto.randomUUID(),
      storeId,
    });

    return this.create(newAccount);
  }

  async addAvailableBalance(accountId: string, amount: number): Promise<Account> {
    const account = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        available: { increment: amount },
        updatedAt: new Date(),
      },
    });

    return this.toDomain(account);
  }

  async addPendingBalance(accountId: string, amount: number): Promise<Account> {
    const account = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        pending: { increment: amount },
        updatedAt: new Date(),
      },
    });

    return this.toDomain(account);
  }

  async releasePendingToAvailable(accountId: string, amount: number): Promise<Account> {
    const account = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        pending: { decrement: amount },
        available: { increment: amount },
        updatedAt: new Date(),
      },
    });

    return this.toDomain(account);
  }

  private toDomain(prismaAccount: AccountEntity): Account {
    return Account.fromPersistence({
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
