import {
  Environment,
  IProductRepository,
  ListProductsOptions,
  ListProductsResult,
  Product,
} from "@hockpay/core";
import { Prisma, PrismaClient } from "@hockpay/database";

export class ProductRepository implements IProductRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async save(product: Product): Promise<void> {
    await (this.prisma as any).product.create({
      data: this.toPrisma(product),
    });
  }

  async update(product: Product): Promise<void> {
    await (this.prisma as any).product.update({
      where: { id: product.id },
      data: {
        externalId: product.externalId,
        name: product.name,
        description: product.description,
        price: product.price,
        currency: product.currency,
        imageUrl: product.imageUrl,
        metadata: product.metadata as any,
        isActive: product.isActive,
        updatedAt: product.updatedAt,
      },
    });
  }

  async findByIdAndStoreId(
    id: string,
    storeId: string,
    environment: Environment,
  ): Promise<Product | null> {
    const row = await (this.prisma as any).product.findFirst({
      where: { id, storeId, environment },
    });
    return row ? this.toDomain(row) : null;
  }

  async findActiveByIdAndStoreId(
    id: string,
    storeId: string,
    environment: Environment,
  ): Promise<Product | null> {
    const row = await (this.prisma as any).product.findFirst({
      where: { id, storeId, environment, isActive: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByExternalIdAndStoreId(
    externalId: string,
    storeId: string,
    environment: Environment,
  ): Promise<Product | null> {
    const row = await (this.prisma as any).product.findFirst({
      where: { externalId, storeId, environment },
    });
    return row ? this.toDomain(row) : null;
  }

  async externalIdExists(
    externalId: string,
    storeId: string,
    environment: Environment,
    excludingProductId?: string,
  ): Promise<boolean> {
    const count = await (this.prisma as any).product.count({
      where: {
        externalId,
        storeId,
        environment,
        ...(excludingProductId ? { id: { not: excludingProductId } } : {}),
      },
    });
    return count > 0;
  }

  async list(options: ListProductsOptions): Promise<ListProductsResult> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: any = {
      storeId: options.storeId,
      environment: options.environment,
    };

    if (options.externalId) where.externalId = options.externalId;
    if (options.isActive !== undefined) where.isActive = options.isActive;
    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { description: { contains: options.search, mode: "insensitive" } },
        { externalId: { contains: options.search, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      (this.prisma as any).product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      (this.prisma as any).product.count({ where }),
    ]);

    return {
      products: rows.map((row: any) => this.toDomain(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private toPrisma(product: Product) {
    return {
      id: product.id,
      storeId: product.storeId,
      externalId: product.externalId,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      imageUrl: product.imageUrl,
      metadata: product.metadata as any,
      environment: product.environment as any,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private toDomain(row: any): Product {
    return Product.reconstitute({
      id: row.id,
      storeId: row.storeId,
      externalId: row.externalId ?? undefined,
      name: row.name,
      description: row.description ?? undefined,
      price: row.price,
      currency: row.currency,
      imageUrl: row.imageUrl ?? undefined,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
      environment: row.environment as Environment,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
