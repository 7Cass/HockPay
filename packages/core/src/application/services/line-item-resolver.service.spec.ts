import { describe, expect, it } from 'vitest';
import { Product } from '../../domain/entities/product.entity';
import { InvalidLineItemsError } from '../../domain/errors/invalid-line-items.error';
import { ProductUnavailableError } from '../../domain/errors/product-unavailable.error';
import { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Environment } from '../../domain/value-objects/environment.vo';
import { LineItemResolverService } from './line-item-resolver.service';

describe('LineItemResolverService', () => {
  it('derives amount and snapshots active product items', async () => {
    const product = Product.create({
      id: 'prod-1',
      storeId: 'store-1',
      environment: Environment.TEST,
      externalId: 'platform-prod-1',
      name: 'Media Kit',
      description: 'Demo kit',
      price: 2500,
      imageUrl: 'https://example.com/product.png',
    });
    const resolver = new LineItemResolverService(new InMemoryProductRepository([product]));

    const result = await resolver.resolve({
      storeId: 'store-1',
      environment: Environment.TEST,
      items: [{ productId: 'prod-1', quantity: 2, metadata: { orderLine: '1' } }],
    });

    expect(result.amount).toBe(5000);
    expect(result.items).toEqual([
      expect.objectContaining({
        productId: 'prod-1',
        productExternalId: 'platform-prod-1',
        name: 'Media Kit',
        quantity: 2,
        unitPrice: 2500,
        totalPrice: 5000,
        metadata: { orderLine: '1' },
      }),
    ]);
  });

  it('rejects inactive product items', async () => {
    const product = Product.create({
      id: 'prod-1',
      storeId: 'store-1',
      environment: Environment.TEST,
      name: 'Archived',
      price: 1000,
      isActive: false,
    });
    const resolver = new LineItemResolverService(new InMemoryProductRepository([product]));

    await expect(
      resolver.resolve({
        storeId: 'store-1',
        environment: Environment.TEST,
        items: [{ productId: 'prod-1' }],
      }),
    ).rejects.toBeInstanceOf(ProductUnavailableError);
  });

  it('rejects line items without a productId', async () => {
    const resolver = new LineItemResolverService(new InMemoryProductRepository([]));

    await expect(
      resolver.resolve({
        storeId: 'store-1',
        environment: Environment.TEST,
        items: [{ name: 'Manual', unitPrice: 1000 } as any],
      }),
    ).rejects.toBeInstanceOf(InvalidLineItemsError);
  });

  it('requires exactly one of amount or items', async () => {
    const resolver = new LineItemResolverService(new InMemoryProductRepository([]));

    await expect(
      resolver.resolve({
        storeId: 'store-1',
        environment: Environment.TEST,
        amount: 1000,
        items: [{ productId: 'prod-1' }],
      }),
    ).rejects.toBeInstanceOf(InvalidLineItemsError);
  });
});

class InMemoryProductRepository implements IProductRepository {
  constructor(private readonly products: Product[]) {}

  async save(product: Product): Promise<void> {
    this.products.push(product);
  }

  async update(product: Product): Promise<void> {
    const index = this.products.findIndex((item) => item.id === product.id);
    if (index >= 0) this.products[index] = product;
  }

  async findByIdAndStoreId(
    id: string,
    storeId: string,
    environment: Environment,
  ): Promise<Product | null> {
    return (
      this.products.find(
        (product) =>
          product.id === id && product.storeId === storeId && product.environment === environment,
      ) ?? null
    );
  }

  async findActiveByIdAndStoreId(
    id: string,
    storeId: string,
    environment: Environment,
  ): Promise<Product | null> {
    const product = await this.findByIdAndStoreId(id, storeId, environment);
    return product?.isActive ? product : null;
  }

  async findByExternalIdAndStoreId(
    externalId: string,
    storeId: string,
    environment: Environment,
  ): Promise<Product | null> {
    return (
      this.products.find(
        (product) =>
          product.externalId === externalId &&
          product.storeId === storeId &&
          product.environment === environment,
      ) ?? null
    );
  }

  async externalIdExists(
    externalId: string,
    storeId: string,
    environment: Environment,
    excludingProductId?: string,
  ): Promise<boolean> {
    return this.products.some(
      (product) =>
        product.externalId === externalId &&
        product.storeId === storeId &&
        product.environment === environment &&
        product.id !== excludingProductId,
    );
  }

  async list() {
    return {
      products: this.products,
      total: this.products.length,
      page: 1,
      limit: this.products.length,
      totalPages: 1,
    };
  }
}
