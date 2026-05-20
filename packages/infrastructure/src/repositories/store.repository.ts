import { Account, IStoreRepository, Store as DomainStore } from "@hockpay/core";
import { PrismaClient, Prisma, Store as PrismaStore } from "@hockpay/database";

export class StoreRepository implements IStoreRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async save(store: DomainStore): Promise<void> {
    const write = async (
      client: PrismaClient | Prisma.TransactionClient,
    ): Promise<void> => {
      const account = Account.create({ storeId: store.id });

      await client.store.create({
        data: {
          id: store.id,
          merchantId: store.merchantId,
          name: store.name,
          slug: store.slug,
          isActive: store.isActive,
          isApproved: store.isApproved,
          settlementDays: store.settlementDays,
          feePercent: store.feePercent,
          feeFixed: store.feeFixed,
          createdAt: store.createdAt,
          updatedAt: store.updatedAt,
        },
      });

      await client.account.create({
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

  async findByIdAndMerchantId(
    id: string,
    merchantId: string,
  ): Promise<DomainStore | null> {
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
        isApproved: store.isApproved,
        settlementDays: store.settlementDays,
        feePercent: store.feePercent,
        feeFixed: store.feeFixed,
        updatedAt: store.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.store.delete({
      where: { id },
    });
  }

  private toDomain(data: PrismaStore): DomainStore {
    return DomainStore.reconstitute({
      id: data.id,
      merchantId: data.merchantId,
      name: data.name,
      slug: data.slug,
      isActive: data.isActive,
      isApproved: data.isApproved,
      settlementDays: data.settlementDays,
      feePercent: Number(data.feePercent),
      feeFixed: data.feeFixed,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  private supportsTransaction(
    prisma: PrismaClient | Prisma.TransactionClient,
  ): prisma is PrismaClient {
    return (
      "$transaction" in prisma && typeof prisma.$transaction === "function"
    );
  }
}
