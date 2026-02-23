import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IStoreRepository, Store as DomainStore } from '@hockpay/core';
import { Store as PrismaStore } from '@hockpay/database';

/**
 * Infrastructure implementation of IStoreRepository.
 *
 * This repository bridges between the domain layer (which uses domain entities)
 * and the infrastructure layer (which uses Prisma ORM).
 */
@Injectable()
export class StoreRepository implements IStoreRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(store: DomainStore): Promise<void> {
    await this.prisma.store.create({
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
  }

  async findById(id: string): Promise<DomainStore | null> {
    const prismaStore = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!prismaStore) {
      return null;
    }

    return this.toDomain(prismaStore);
  }

  async findByIdAndMerchantId(
    id: string,
    merchantId: string,
  ): Promise<DomainStore | null> {
    const prismaStore = await this.prisma.store.findFirst({
      where: {
        id,
        merchantId,
      },
    });

    if (!prismaStore) {
      return null;
    }

    return this.toDomain(prismaStore);
  }

  async findBySlug(slug: string): Promise<DomainStore | null> {
    const prismaStore = await this.prisma.store.findUnique({
      where: { slug },
    });

    if (!prismaStore) {
      return null;
    }

    return this.toDomain(prismaStore);
  }

  async findByMerchantId(merchantId: string): Promise<DomainStore[]> {
    const prismaStores = await this.prisma.store.findMany({
      where: { merchantId },
    });

    return prismaStores.map((store) => this.toDomain(store));
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

  /**
   * Convert a Prisma Store to a Domain Store.
   */
  private toDomain(prismaStore: PrismaStore): DomainStore {
    return DomainStore.reconstitute({
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
