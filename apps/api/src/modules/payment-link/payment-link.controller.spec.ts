import {
  CancelPaymentLinkUseCase,
  CreatePaymentLinkUseCase,
  Environment,
  FailPaymentLinkUseCase,
  GetPaymentLinkUseCase,
  InvalidLineItemsError,
  ListPaymentLinksUseCase,
  OpenPaymentLinkUseCase,
  PayPaymentLinkUseCase,
} from '@hockpay/core';
import { PaymentLinkController } from './payment-link.controller';

describe('PaymentLinkController', () => {
  let controller: PaymentLinkController;
  let createUseCase: { execute: jest.Mock; executeInTransaction: jest.Mock };
  let getUseCase: { execute: jest.Mock };
  let cancelUseCase: { execute: jest.Mock };
  let payUseCase: { execute: jest.Mock };
  let failUseCase: { execute: jest.Mock };

  beforeEach(() => {
    createUseCase = {
      execute: jest.fn().mockResolvedValue({
        paymentLink: { id: 'link-1' },
      }),
      executeInTransaction: jest.fn().mockResolvedValue({
        paymentLink: { id: 'link-1' },
      }),
    };
    getUseCase = {
      execute: jest.fn().mockResolvedValue({
        paymentLink: {
          id: 'link-1',
          publicToken: 'public-token',
        },
      }),
    };
    payUseCase = {
      execute: jest.fn().mockResolvedValue({
        payment: { id: 'payment-1', status: 'CONFIRMED' },
      }),
    };
    failUseCase = {
      execute: jest.fn().mockResolvedValue({
        payment: { id: 'payment-1', status: 'FAILED' },
      }),
    };
    cancelUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    controller = new PaymentLinkController(
      createUseCase as unknown as CreatePaymentLinkUseCase,
      { execute: jest.fn() } as unknown as ListPaymentLinksUseCase,
      getUseCase as unknown as GetPaymentLinkUseCase,
      cancelUseCase as unknown as CancelPaymentLinkUseCase,
      { execute: jest.fn() } as unknown as OpenPaymentLinkUseCase,
      payUseCase as unknown as PayPaymentLinkUseCase,
      failUseCase as unknown as FailPaymentLinkUseCase,
      {
        execute: jest.fn(async (input) => ({
          body: await input.operation({}),
          status: input.responseStatus,
          replayed: false,
        })),
      } as never,
    );
  });

  it('forwards amount-only payload on creation with store and environment context', async () => {
    await controller.create(
      {
        amount: 2500,
        title: 'Avulso',
      } as any,
      'store-1',
      Environment.TEST,
      {
        method: 'POST',
        path: '/payment-links',
        headers: { 'idempotency-key': 'idem-1' },
      } as any,
      { status: jest.fn(), setHeader: jest.fn() } as any,
    );

    expect(createUseCase.executeInTransaction).toHaveBeenCalledWith(
      {
        storeId: 'store-1',
        environment: Environment.TEST,
        amount: 2500,
        items: undefined,
        title: 'Avulso',
        description: undefined,
        internalReference: undefined,
        expiresAt: undefined,
      },
      expect.anything(),
    );
  });

  it('propagates itemized payment link creation as a domain error', async () => {
    createUseCase.executeInTransaction.mockRejectedValue(
      new InvalidLineItemsError(
        'Payment links do not support items; provide amount',
      ),
    );

    await expect(
      controller.create(
        {
          items: [{ productId: 'product-1', quantity: 1 }],
          title: 'Catalog order',
        } as any,
        'store-1',
        Environment.TEST,
        {
          method: 'POST',
          path: '/payment-links',
          headers: { 'idempotency-key': 'idem-1' },
        } as any,
        { status: jest.fn(), setHeader: jest.fn() } as any,
      ),
    ).rejects.toBeInstanceOf(InvalidLineItemsError);
  });

  it('scopes authenticated pay simulation by store before using the public token flow', async () => {
    const result = await controller.payAuthenticated(
      'link-1',
      'store-1',
      Environment.TEST,
      { id: 'req-1' } as any,
    );

    expect(getUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentLinkId: 'link-1',
      environment: Environment.TEST,
    });
    expect(payUseCase.execute).toHaveBeenCalledWith({
      publicToken: 'public-token',
      requestId: 'req-1',
      environment: Environment.TEST,
    });
    expect(result).toEqual({
      payment: { id: 'payment-1', status: 'CONFIRMED' },
    });
  });

  it('scopes authenticated fail simulation by store before using the public token flow', async () => {
    const result = await controller.failAuthenticated(
      'link-1',
      'store-1',
      Environment.TEST,
      'manual fail',
      { id: 'req-1' } as any,
    );

    expect(getUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentLinkId: 'link-1',
      environment: Environment.TEST,
    });
    expect(failUseCase.execute).toHaveBeenCalledWith({
      publicToken: 'public-token',
      requestId: 'req-1',
      environment: Environment.TEST,
      reason: 'manual fail',
    });
    expect(result).toEqual({
      payment: { id: 'payment-1', status: 'FAILED' },
    });
  });

  it('forwards JWT TEST environment so cancel cannot drop the caller context', async () => {
    await controller.cancel('link-1', 'store-1', Environment.TEST, {
      id: 'req-cancel-jwt',
    } as never);

    expect(cancelUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentLinkId: 'link-1',
      environment: Environment.TEST,
      requestId: 'req-cancel-jwt',
    });
  });

  it('forwards API key LIVE environment so cancel can mutate a LIVE link', async () => {
    await controller.cancel('link-1', 'store-1', Environment.LIVE, {
      id: 'req-cancel-key',
    } as never);

    expect(cancelUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentLinkId: 'link-1',
      environment: Environment.LIVE,
      requestId: 'req-cancel-key',
    });
  });

  it('rejects authenticated payment link simulation in live environment', async () => {
    await expect(
      controller.payAuthenticated(
        'link-1',
        'store-1',
        Environment.LIVE,
        {} as any,
      ),
    ).rejects.toMatchObject({ code: 'LIVE_ENVIRONMENT_NOT_ALLOWED' });

    expect(getUseCase.execute).not.toHaveBeenCalled();
    expect(payUseCase.execute).not.toHaveBeenCalled();
  });
});
