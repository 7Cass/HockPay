import {
  Account,
  Environment,
  IStoreRepository,
  Store as DomainStore,
  StoreLiveStatus,
} from '@hockpay/core';
import { PrismaClient, Prisma, Store as PrismaStore } from '@hockpay/database';

interface StoreRow {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  isActive: boolean;
  liveStatus: string;
  liveStatusReason: string | null;
  liveStatusChangedAt: Date | null;
  settlementDays: number;
  feePercent: unknown;
  feeFixed: number;
  city: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class StoreRepository implements IStoreRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async save(store: DomainStore): Promise<void> {
    const write = async (client: PrismaClient | Prisma.TransactionClient): Promise<void> => {
      // Uma conta por ambiente, criadas juntas. Criar a conta LIVE sob demanda
      // seria uma condicional a mais em todo caminho de escrita, e um 500
      // esperando o primeiro caminho que esquecesse dela.
      const accounts = [Environment.TEST, Environment.LIVE].map((environment) =>
        Account.create({ storeId: store.id, environment }),
      );

      await client.store.create({
        data: {
          id: store.id,
          merchantId: store.merchantId,
          name: store.name,
          slug: store.slug,
          isActive: store.isActive,
          liveStatus: store.liveStatus,
          liveStatusReason: store.liveStatusReason,
          liveStatusChangedAt: store.liveStatusChangedAt,
          settlementDays: store.settlementDays,
          feePercent: store.feePercent,
          feeFixed: store.feeFixed,
          city: store.city,
          createdAt: store.createdAt,
          updatedAt: store.updatedAt,
        },
      });

      await client.account.createMany({
        data: accounts.map((account) => ({
          id: account.id,
          storeId: account.storeId,
          environment: account.environment,
          available: account.available,
          pending: account.pending,
          blocked: account.blocked,
          currency: account.currency,
          updatedAt: account.updatedAt,
        })),
      });
    };

    if (this.supportsTransaction(this.prisma)) {
      await this.prisma.$transaction(write);
      return;
    }

    await write(this.prisma);
  }

  async findById(id: string): Promise<DomainStore | null> {
    const data = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!data) return null;
    return this.toDomain(data);
  }

  async findByIdForUpdate(id: string): Promise<DomainStore | null> {
    const rows = await this.prisma.$queryRaw<StoreRow[]>`
      SELECT
        id,
        merchant_id AS "merchantId",
        name,
        slug,
        is_active AS "isActive",
        live_status AS "liveStatus",
        live_status_reason AS "liveStatusReason",
        live_status_changed_at AS "liveStatusChangedAt",
        settlement_days AS "settlementDays",
        fee_percent AS "feePercent",
        fee_fixed AS "feeFixed",
        city,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM stores
      WHERE id = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.toDomainFromRaw(row) : null;
  }

  async findByIdAndMerchantId(id: string, merchantId: string): Promise<DomainStore | null> {
    const data = await this.prisma.store.findFirst({
      where: { id, merchantId },
    });

    if (!data) return null;
    return this.toDomain(data);
  }

  async findBySlug(slug: string): Promise<DomainStore | null> {
    const data = await this.prisma.store.findUnique({
      where: { slug },
    });

    if (!data) return null;
    return this.toDomain(data);
  }

  async findByMerchantId(merchantId: string): Promise<DomainStore[]> {
    const data = await this.prisma.store.findMany({
      where: { merchantId },
    });

    return data.map((item) => this.toDomain(item));
  }

  async update(store: DomainStore): Promise<void> {
    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        name: store.name,
        isActive: store.isActive,
        liveStatus: store.liveStatus,
        liveStatusReason: store.liveStatusReason ?? null,
        liveStatusChangedAt: store.liveStatusChangedAt ?? null,
        settlementDays: store.settlementDays,
        feePercent: store.feePercent,
        feeFixed: store.feeFixed,
        city: store.city,
        updatedAt: store.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.store.delete({
      where: { id },
    });
  }

  async listActive(): Promise<DomainStore[]> {
    const rows = await this.prisma.store.findMany({
      where: {
        isActive: true,
      },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async listByLiveStatus(params: {
    liveStatus?: StoreLiveStatus;
    limit: number;
    offset: number;
  }): Promise<DomainStore[]> {
    const rows = await this.prisma.store.findMany({
      where: params.liveStatus ? { liveStatus: params.liveStatus } : undefined,
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      skip: params.offset,
    });

    return rows.map((row) => this.toDomain(row));
  }

  private toDomainFromRaw(row: StoreRow): DomainStore {
    return DomainStore.reconstitute({
      id: row.id,
      merchantId: row.merchantId,
      name: row.name,
      slug: row.slug,
      isActive: row.isActive,
      liveStatus: row.liveStatus as StoreLiveStatus,
      liveStatusReason: row.liveStatusReason ?? undefined,
      liveStatusChangedAt: row.liveStatusChangedAt ?? undefined,
      settlementDays: row.settlementDays,
      feePercent: Number(row.feePercent),
      feeFixed: row.feeFixed,
      city: row.city ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private toDomain(data: PrismaStore): DomainStore {
    return DomainStore.reconstitute({
      id: data.id,
      merchantId: data.merchantId,
      name: data.name,
      slug: data.slug,
      isActive: data.isActive,
      liveStatus: data.liveStatus as StoreLiveStatus,
      liveStatusReason: data.liveStatusReason ?? undefined,
      liveStatusChangedAt: data.liveStatusChangedAt ?? undefined,
      settlementDays: data.settlementDays,
      feePercent: Number(data.feePercent),
      feeFixed: data.feeFixed,
      city: data.city ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  private supportsTransaction(
    prisma: PrismaClient | Prisma.TransactionClient,
  ): prisma is PrismaClient {
    return '$transaction' in prisma && typeof prisma.$transaction === 'function';
  }
}
