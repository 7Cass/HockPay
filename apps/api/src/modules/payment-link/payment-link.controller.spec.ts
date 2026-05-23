import { UnprocessableEntityException } from '@nestjs/common';
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
  let createUseCase: { execute: jest.Mock };
  let getUseCase: { execute: jest.Mock };
  let payUseCase: { execute: jest.Mock };
  let failUseCase: { execute: jest.Mock };

  beforeEach(() => {
    createUseCase = {
      execute: jest.fn().mockResolvedValue({
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

    controller = new PaymentLinkController(
      createUseCase as unknown as CreatePaymentLinkUseCase,
      { execute: jest.fn() } as unknown as ListPaymentLinksUseCase,
      getUseCase as unknown as GetPaymentLinkUseCase,
      { execute: jest.fn() } as unknown as CancelPaymentLinkUseCase,
      { execute: jest.fn() } as unknown as OpenPaymentLinkUseCase,
      payUseCase as unknown as PayPaymentLinkUseCase,
      failUseCase as unknown as FailPaymentLinkUseCase,
    );
  });

  it('forwards amount-only payload on creation with store and environment context', async () => {
    await controller.create(
      {
        amount: 2500,
        title: 'Avulso',
      } as any,
      {
        store: { id: 'store-1' },
        environment: Environment.TEST,
      } as any,
    );

    expect(createUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      environment: Environment.TEST,
      amount: 2500,
      items: undefined,
      title: 'Avulso',
      description: undefined,
      internalReference: undefined,
      expiresAt: undefined,
    });
  });

  it('maps itemized payment link creation to an explicit contract error', async () => {
    createUseCase.execute.mockRejectedValue(
      new InvalidLineItemsError('Payment links do not support items; provide amount'),
    );

    await expect(
      controller.create(
        {
          items: [{ productId: 'product-1', quantity: 1 }],
          title: 'Catalog order',
        } as any,
        {
          store: { id: 'store-1' },
          environment: Environment.TEST,
        } as any,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('scopes authenticated pay simulation by store before using the public token flow', async () => {
    const result = await controller.payAuthenticated('link-1', {
      store: { id: 'store-1' },
      environment: Environment.TEST,
      id: 'req-1',
    } as any);

    expect(getUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentLinkId: 'link-1',
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
    const result = await controller.failAuthenticated('link-1', 'manual fail', {
      store: { id: 'store-1' },
      environment: Environment.TEST,
      id: 'req-1',
    } as any);

    expect(getUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentLinkId: 'link-1',
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

  it('rejects authenticated payment link simulation in live environment', async () => {
    await expect(
      controller.payAuthenticated('link-1', {
        store: { id: 'store-1' },
        environment: Environment.LIVE,
      } as any),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(getUseCase.execute).not.toHaveBeenCalled();
    expect(payUseCase.execute).not.toHaveBeenCalled();
  });
});
