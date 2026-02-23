import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  IMerchantRepository,
  Merchant as DomainMerchant,
  Email,
  Document,
} from '@hockpay/core';
import { Merchant as PrismaMerchant } from '@hockpay/database';

/**
 * Infrastructure implementation of IMerchantRepository.
 *
 * This repository bridges between the domain layer (which uses domain entities)
 * and the infrastructure layer (which uses Prisma ORM).
 *
 * It converts between Prisma models and Domain entities.
 */
@Injectable()
export class MerchantRepository implements IMerchantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(merchant: DomainMerchant): Promise<void> {
    await this.prisma.merchant.create({
      data: {
        id: merchant.id,
        email: merchant.email.toString(),
        passwordHash: merchant.passwordHash,
        name: merchant.name,
        document: merchant.document.value,
        isActive: merchant.isActive,
        createdAt: merchant.createdAt,
        updatedAt: merchant.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<DomainMerchant | null> {
    const prismaMerchant = await this.prisma.merchant.findUnique({
      where: { id },
    });

    if (!prismaMerchant) {
      return null;
    }

    return this.toDomain(prismaMerchant);
  }

  async findByEmail(email: string): Promise<DomainMerchant | null> {
    const prismaMerchant = await this.prisma.merchant.findUnique({
      where: { email },
    });

    if (!prismaMerchant) {
      return null;
    }

    return this.toDomain(prismaMerchant);
  }

  async findByDocument(document: string): Promise<DomainMerchant | null> {
    const prismaMerchant = await this.prisma.merchant.findFirst({
      where: { document },
    });

    if (!prismaMerchant) {
      return null;
    }

    return this.toDomain(prismaMerchant);
  }

  async existsByEmailOrDocument(
    email: string,
    document: string,
  ): Promise<boolean> {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        OR: [{ email }, { document }],
      },
    });

    return !!merchant;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.merchant.delete({
      where: { id },
    });
  }

  async update(merchant: DomainMerchant): Promise<void> {
    await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        email: merchant.email.toString(),
        passwordHash: merchant.passwordHash,
        name: merchant.name,
        document: merchant.document.value,
        isActive: merchant.isActive,
        updatedAt: merchant.updatedAt,
      },
    });
  }

  /**
   * Convert a Prisma Merchant to a Domain Merchant.
   * This is a private helper method for internal use.
   */
  private toDomain(prismaMerchant: PrismaMerchant): DomainMerchant {
    return DomainMerchant.reconstitute({
      id: prismaMerchant.id,
      email: new Email(prismaMerchant.email),
      document: new Document(prismaMerchant.document),
      passwordHash: prismaMerchant.passwordHash,
      name: prismaMerchant.name,
      isActive: prismaMerchant.isActive,
      createdAt: prismaMerchant.createdAt,
      updatedAt: prismaMerchant.updatedAt,
    });
  }
}
