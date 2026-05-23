import { UnprocessableEntityException } from '@nestjs/common';
import {
  CreateCheckoutSessionUseCase,
  CustomerIdentityConflictError,
  Environment,
  FulfillCheckoutSessionUseCase,
  GetCheckoutSessionUseCase,
} from '@hockpay/core';
import { CheckoutSessionController } from './checkout-session.controller';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

describe('CheckoutSessionController', () => {
  let controller: CheckoutSessionController;
  let createUseCase: { execute: jest.Mock };
  let getUseCase: { execute: jest.Mock };
  let fulfillUseCase: { execute: jest.Mock };

  beforeEach(() => {
    createUseCase = { execute: jest.fn() };
    getUseCase = { execute: jest.fn() };
    fulfillUseCase = { execute: jest.fn() };

    controller = new CheckoutSessionController(
      createUseCase as unknown as CreateCheckoutSessionUseCase,
      getUseCase as unknown as GetCheckoutSessionUseCase,
      fulfillUseCase as unknown as FulfillCheckoutSessionUseCase,
    );
  });

  it('marks the controller as public for token access and CombinedAuthGuard composition', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, CheckoutSessionController)).toBe(
      true,
    );
  });

  it('forwards prefillCustomer on checkout-session creation', async () => {
    createUseCase.execute.mockResolvedValue({
      id: 'session-1',
      checkoutToken: 'token',
      checkoutUrl: 'http://localhost:3333/token',
      customerCollectionMode: 'IDENTIFIED',
      prefillCustomer: {
        externalId: 'cust_123',
        document: '52998224725',
        name: 'Joao',
        email: 'joao@example.com',
      },
    });

    await controller.createSession(
      {
        amount: 7990,
        customerCollectionMode: 'IDENTIFIED' as any,
        prefillCustomer: {
          externalId: 'cust_123',
          document: '52998224725',
          name: 'Joao',
          email: 'joao@example.com',
        },
      } as any,
      {
        store: { id: 'store-1' },
      } as any,
    );

    expect(createUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      environment: Environment.TEST,
      amount: 7990,
      items: undefined,
      description: undefined,
      customerCollectionMode: 'IDENTIFIED',
      prefillCustomer: {
        externalId: 'cust_123',
        document: '52998224725',
        name: 'Joao',
        email: 'joao@example.com',
      },
      successUrl: undefined,
      cancelUrl: undefined,
      expiresInSeconds: undefined,
      metadata: undefined,
    });
  });

  it('forwards catalog items on checkout-session creation', async () => {
    createUseCase.execute.mockResolvedValue({
      id: 'session-1',
      checkoutToken: 'token',
      checkoutUrl: 'http://localhost:3333/token',
      customerCollectionMode: 'IDENTIFIED',
      prefillCustomer: null,
    });

    await controller.createSession(
      {
        items: [
          {
            productId: 'product-1',
            quantity: 2,
            metadata: { line: 'catalog' },
          },
        ],
        description: 'Catalog checkout',
      } as any,
      {
        store: { id: 'store-1' },
        environment: Environment.TEST,
      } as any,
    );

    expect(createUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      environment: Environment.TEST,
      amount: undefined,
      items: [
        {
          productId: 'product-1',
          quantity: 2,
          metadata: { line: 'catalog' },
        },
      ],
      description: 'Catalog checkout',
      customerCollectionMode: undefined,
      prefillCustomer: undefined,
      successUrl: undefined,
      cancelUrl: undefined,
      expiresInSeconds: undefined,
      metadata: undefined,
    });
  });

  it('maps customer identity conflicts to 422 on fulfill', async () => {
    fulfillUseCase.execute.mockRejectedValue(
      new CustomerIdentityConflictError(),
    );

    await expect(
      controller.fulfillSession('token', { customer: {} } as any, {} as any),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
