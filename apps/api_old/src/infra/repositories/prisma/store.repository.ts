import { Injectable } from '@nestjs/common';
import { Store as StoreEntity } from '@hockpay/database';
import { Store } from '../../../domain/entities/store.entity';
import { PrismaService } from '../../database/prisma.service';

/**
 * Implementação do StoreRepository usando Prisma
 */
@Injectable()
export class StoreRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Store | null> {
    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      return null;
    }

    return this.toDomain(store);
  }

  async findBySlug(slug: string): Promise<Store | null> {
    const store = await this.prisma.store.findUnique({
      where: { slug },
    });

    if (!store) {
      return null;
    }

    return this.toDomain(store);
  }

  async findByMerchantId(merchantId: string): Promise<Store[]> {
    const stores = await this.prisma.store.findMany({
      where: { merchantId },
    });

    return stores.map(s => this.toDomain(s));
  }

  async save(store: Store): Promise<Store> {
    const data = store.toPersistence();

    const updated = await this.prisma.store.update({
      where: { id: store.id },
      data: {
        name: data.name,
        slug: data.slug,
        isActive: data.isActive,
        isApproved: data.isApproved,
        settlementDays: data.settlementDays,
        feePercent: data.feePercent,
        feeFixed: data.feeFixed,
        updatedAt: new Date(),
      },
    });

    return this.toDomain(updated);
  }

  async create(store: Store): Promise<Store> {
    const data = store.toPersistence();

    const created = await this.prisma.store.create({
      data,
    });

    return this.toDomain(created);
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const where: any = { slug };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.store.count({ where });
    return count > 0;
  }

  private toDomain(prismaStore: StoreEntity): Store {
    return Store.fromPersistence({
      id: prismaStore.id,
      merchantId: prismaStore.merchantId,
      name: prismaStore.name,
      slug: prismaStore.slug,
      isActive: prismaStore.isActive,
      isApproved: prismaStore.isApproved,
      settlementDays: prismaStore.settlementDays,
      feePercent: Number(prismaStore.feePercent),
      feeFixed: prismaStore.feeFixed,
      createdAt: prismaStore.createdAt,
      updatedAt: prismaStore.updatedAt,
    });
  }
}
