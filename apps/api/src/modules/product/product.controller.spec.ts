import { ConflictException } from '@nestjs/common';
import {
  CreateProductUseCase,
  Environment,
  GetProductUseCase,
  ListProductsUseCase,
  ProductExternalIdAlreadyExistsError,
  UpdateProductUseCase,
} from '@hockpay/core';
import { ProductController } from './product.controller';

describe('ProductController', () => {
  let controller: ProductController;
  let createUseCase: { execute: jest.Mock };
  let listUseCase: { execute: jest.Mock };
  let getUseCase: { execute: jest.Mock };
  let updateUseCase: { execute: jest.Mock };

  beforeEach(() => {
    createUseCase = { execute: jest.fn() };
    listUseCase = { execute: jest.fn() };
    getUseCase = { execute: jest.fn() };
    updateUseCase = { execute: jest.fn() };

    controller = new ProductController(
      createUseCase as unknown as CreateProductUseCase,
      listUseCase as unknown as ListProductsUseCase,
      getUseCase as unknown as GetProductUseCase,
      updateUseCase as unknown as UpdateProductUseCase,
    );
  });

  it('forwards product creation with store and environment context', async () => {
    createUseCase.execute.mockResolvedValue({
      product: {
        id: 'product-1',
        storeId: 'store-1',
        name: 'Media kit',
        price: 2500,
        currency: 'BRL',
        environment: Environment.TEST,
        isActive: true,
      },
    });

    await controller.create(
      {
        externalId: 'media-kit',
        name: 'Media kit',
        description: 'Premium package',
        price: 2500,
        imageUrl: 'http://localhost/image.png',
        metadata: { category: 'demo' },
      },
      {
        store: { id: 'store-1' },
        environment: Environment.TEST,
      } as any,
    );

    expect(createUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      environment: Environment.TEST,
      externalId: 'media-kit',
      name: 'Media kit',
      description: 'Premium package',
      price: 2500,
      imageUrl: 'http://localhost/image.png',
      metadata: { category: 'demo' },
    });
  });

  it('forwards product listing filters', async () => {
    listUseCase.execute.mockResolvedValue({
      products: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    await controller.list(
      {
        page: 2,
        limit: 10,
        externalId: 'media-kit',
        isActive: true,
        search: 'media',
      },
      {
        store: { id: 'store-1' },
        environment: Environment.LIVE,
      } as any,
    );

    expect(listUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      environment: Environment.LIVE,
      page: 2,
      limit: 10,
      externalId: 'media-kit',
      isActive: true,
      search: 'media',
    });
  });

  it('maps duplicate externalId to conflict', async () => {
    createUseCase.execute.mockRejectedValue(
      new ProductExternalIdAlreadyExistsError('media-kit'),
    );

    await expect(
      controller.create(
        {
          externalId: 'media-kit',
          name: 'Media kit',
          price: 2500,
        },
        {
          store: { id: 'store-1' },
          environment: Environment.TEST,
        } as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
