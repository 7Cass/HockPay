import {
  CreateCheckoutSessionUseCase,
  CheckoutSessionNotFoundError,
  CustomerIdentityConflictError,
  Environment,
  FulfillCheckoutSessionUseCase,
  GetCheckoutSessionUseCase,
} from '@hockpay/core';
import { CheckoutSessionController } from './checkout-session.controller';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

describe('CheckoutSessionController', () => {
  let controller: CheckoutSessionController;
  let createUseCase: { execute: jest.Mock; executeInTransaction: jest.Mock };
  let getUseCase: { execute: jest.Mock };
  let fulfillUseCase: { execute: jest.Mock };
  let idempotencyService: { execute: jest.Mock };

  beforeEach(() => {
    createUseCase = {
      execute: jest.fn(),
      executeInTransaction: jest.fn(),
    };
    getUseCase = { execute: jest.fn() };
    fulfillUseCase = { execute: jest.fn() };
    idempotencyService = {
      execute: jest.fn(async (input) => ({
        body: await input.operation({}),
        status: input.responseStatus,
        replayed: false,
      })),
    };

    controller = new CheckoutSessionController(
      createUseCase as unknown as CreateCheckoutSessionUseCase,
      getUseCase as unknown as GetCheckoutSessionUseCase,
      fulfillUseCase as unknown as FulfillCheckoutSessionUseCase,
      idempotencyService as never,
    );
  });

  it('marks the controller as public for token access and CombinedAuthGuard composition', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, CheckoutSessionController)).toBe(
      true,
    );
  });

  it('forwards prefillCustomer on checkout-session creation', async () => {
    createUseCase.executeInTransaction.mockResolvedValue({
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
      'store-1',
      Environment.TEST,
      {
        method: 'POST',
        path: '/checkout-sessions',
        headers: { 'idempotency-key': 'idem-1' },
      } as any,
      { status: jest.fn(), setHeader: jest.fn() } as any,
    );

    expect(createUseCase.executeInTransaction).toHaveBeenCalledWith(
      {
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
      },
      expect.anything(),
    );
  });

  it('forwards catalog items on checkout-session creation', async () => {
    createUseCase.executeInTransaction.mockResolvedValue({
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
      'store-1',
      Environment.TEST,
      {
        method: 'POST',
        path: '/checkout-sessions',
        headers: { 'idempotency-key': 'idem-1' },
      } as any,
      { status: jest.fn(), setHeader: jest.fn() } as any,
    );

    expect(createUseCase.executeInTransaction).toHaveBeenCalledWith(
      {
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
      },
      expect.anything(),
    );
  });

  it('propagates checkout-session-not-found from get for the domain filter', async () => {
    getUseCase.execute.mockRejectedValue(
      new CheckoutSessionNotFoundError('missing'),
    );

    await expect(controller.getSession('missing')).rejects.toBeInstanceOf(
      CheckoutSessionNotFoundError,
    );
  });

  it('propagates customer identity conflicts from fulfill for the domain filter', async () => {
    fulfillUseCase.execute.mockRejectedValue(
      new CustomerIdentityConflictError(),
    );

    await expect(
      controller.fulfillSession('token', { customer: {} } as any, {} as any),
    ).rejects.toBeInstanceOf(CustomerIdentityConflictError);
  });
});
