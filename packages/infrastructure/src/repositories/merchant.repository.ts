import { Document, Email, IMerchantRepository, Merchant as DomainMerchant } from '@hockpay/core';
import { Merchant as PrismaMerchant, Prisma, PrismaClient } from '@hockpay/database';

type MerchantRow = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  document: string;
  isActive: boolean;
  currentStoreId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class MerchantRepository implements IMerchantRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async save(merchant: DomainMerchant): Promise<void> {
    await this.prisma.merchant.create({
      data: {
        id: merchant.id,
        email: merchant.email.toString(),
        passwordHash: merchant.passwordHash,
        name: merchant.name,
        document: merchant.document.value,
        isActive: merchant.isActive,
        currentStoreId: merchant.currentStoreId,
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

  async findByIdForUpdate(id: string): Promise<DomainMerchant | null> {
    const rows = await this.prisma.$queryRaw<MerchantRow[]>`
      SELECT
        id,
        email,
        password_hash AS "passwordHash",
        name,
        document,
        is_active AS "isActive",
        current_store_id AS "currentStoreId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM merchants
      WHERE id = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    if (!row) {
      return null;
    }

    return this.toDomain(row);
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

  async existsByEmailOrDocument(email: string, document: string): Promise<boolean> {
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
        currentStoreId: merchant.currentStoreId,
        updatedAt: merchant.updatedAt,
      },
    });
  }

  private toDomain(prismaMerchant: PrismaMerchant | MerchantRow): DomainMerchant {
    return DomainMerchant.reconstitute({
      id: prismaMerchant.id,
      email: new Email(prismaMerchant.email),
      document: new Document(prismaMerchant.document),
      passwordHash: prismaMerchant.passwordHash,
      name: prismaMerchant.name,
      isActive: prismaMerchant.isActive,
      currentStoreId: prismaMerchant.currentStoreId ?? undefined,
      createdAt: prismaMerchant.createdAt,
      updatedAt: prismaMerchant.updatedAt,
    });
  }
}
