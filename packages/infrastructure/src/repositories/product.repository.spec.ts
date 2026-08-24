import { describe, expect, it, vi } from 'vitest';
import { Environment, Product } from '@hockpay/core';
import { ProductRepository } from './product.repository';

describe('ProductRepository', () => {
  it('creates products with catalog fields', async () => {
    const prisma = {
      product: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
    const repository = new ProductRepository(prisma as any);
    const product = Product.create({
      id: 'product-1',
      storeId: 'store-1',
      externalId: 'media-kit',
      name: 'Media kit',
      description: 'Premium package',
      price: 2500,
      imageUrl: 'http://localhost/media-kit.png',
      metadata: { category: 'demo' },
      environment: Environment.TEST,
    });

    await repository.save(product);

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'product-1',
        storeId: 'store-1',
        externalId: 'media-kit',
        name: 'Media kit',
        description: 'Premium package',
        price: 2500,
        currency: 'BRL',
        imageUrl: 'http://localhost/media-kit.png',
        metadata: { category: 'demo' },
        environment: Environment.TEST,
        isActive: true,
      }),
    });
  });

  it('scopes externalId uniqueness by store and environment', async () => {
    const prisma = {
      product: {
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const repository = new ProductRepository(prisma as any);

    const exists = await repository.externalIdExists(
      'media-kit',
      'store-1',
      Environment.LIVE,
      'product-1',
    );

    expect(exists).toBe(true);
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: {
        externalId: 'media-kit',
        storeId: 'store-1',
        environment: Environment.LIVE,
        id: { not: 'product-1' },
      },
    });
  });

  it('lists products with active, externalId, and search filters', async () => {
    const prisma = {
      product: {
        findMany: vi.fn().mockResolvedValue([makeProductRow()]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const repository = new ProductRepository(prisma as any);

    const result = await repository.list({
      storeId: 'store-1',
      environment: Environment.TEST,
      page: 2,
      limit: 5,
      externalId: 'media',
      isActive: true,
      search: 'kit',
    });

    const where = {
      storeId: 'store-1',
      environment: Environment.TEST,
      externalId: 'media',
      isActive: true,
      OR: [
        { name: { contains: 'kit', mode: 'insensitive' } },
        { description: { contains: 'kit', mode: 'insensitive' } },
        { externalId: { contains: 'kit', mode: 'insensitive' } },
      ],
    };
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where,
      skip: 5,
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.product.count).toHaveBeenCalledWith({ where });
    expect(result.products[0].id).toBe('product-1');
    expect(result.totalPages).toBe(1);
  });
});

function makeProductRow() {
  const now = new Date('2026-05-23T00:00:00.000Z');
  return {
    id: 'product-1',
    storeId: 'store-1',
    externalId: 'media-kit',
    name: 'Media kit',
    description: 'Premium package',
    price: 2500,
    currency: 'BRL',
    imageUrl: 'http://localhost/media-kit.png',
    metadata: { category: 'demo' },
    environment: Environment.TEST,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}
