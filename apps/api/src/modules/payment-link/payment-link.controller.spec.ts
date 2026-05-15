import { UnprocessableEntityException } from '@nestjs/common';
import {
  CancelPaymentLinkUseCase,
  CreatePaymentLinkUseCase,
  Environment,
  FailPaymentLinkUseCase,
  GetPaymentLinkUseCase,
  ListPaymentLinksUseCase,
  OpenPaymentLinkUseCase,
  PayPaymentLinkUseCase,
} from '@hockpay/core';
import { PaymentLinkController } from './payment-link.controller';

describe('PaymentLinkController', () => {
  let controller: PaymentLinkController;
  let getUseCase: { execute: jest.Mock };
  let payUseCase: { execute: jest.Mock };
  let failUseCase: { execute: jest.Mock };

  beforeEach(() => {
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
      { execute: jest.fn() } as unknown as CreatePaymentLinkUseCase,
      { execute: jest.fn() } as unknown as ListPaymentLinksUseCase,
      getUseCase as unknown as GetPaymentLinkUseCase,
      { execute: jest.fn() } as unknown as CancelPaymentLinkUseCase,
      { execute: jest.fn() } as unknown as OpenPaymentLinkUseCase,
      payUseCase as unknown as PayPaymentLinkUseCase,
      failUseCase as unknown as FailPaymentLinkUseCase,
    );
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
