import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AccountNotFoundError,
  ConfirmPaymentUseCase,
  Environment,
  ExpirePaymentUseCase,
  FailPaymentUseCase,
  PaymentNotConfirmedError,
  ReleasePaymentUseCase,
} from '@hockpay/core';
import { DevController } from './dev.controller';

describe('DevController', () => {
  let controller: DevController;
  let confirmPaymentUseCase: { execute: jest.Mock };
  let expirePaymentUseCase: { execute: jest.Mock };
  let failPaymentUseCase: { execute: jest.Mock };
  let releasePaymentUseCase: { execute: jest.Mock };

  beforeEach(() => {
    confirmPaymentUseCase = { execute: jest.fn() };
    expirePaymentUseCase = { execute: jest.fn() };
    failPaymentUseCase = { execute: jest.fn() };
    releasePaymentUseCase = { execute: jest.fn() };

    controller = new DevController(
      confirmPaymentUseCase as unknown as ConfirmPaymentUseCase,
      expirePaymentUseCase as unknown as ExpirePaymentUseCase,
      failPaymentUseCase as unknown as FailPaymentUseCase,
      releasePaymentUseCase as unknown as ReleasePaymentUseCase,
    );
  });

  it('forwards storeId, paymentId, and requestId to the release use case', async () => {
    releasePaymentUseCase.execute.mockResolvedValue({
      payment: { id: 'payment-1', status: 'RELEASED' },
      account: { id: 'account-1' },
      alreadyReleased: false,
    });

    const result = await controller.releasePayment('payment-1', {
      environment: Environment.TEST,
      store: { id: 'store-1' },
      id: 'req-1',
    } as any);

    expect(releasePaymentUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentId: 'payment-1',
      requestId: 'req-1',
    });
    expect(result).toEqual({
      payment: { id: 'payment-1', status: 'RELEASED' },
    });
  });

  it('rejects release simulation in live environment', async () => {
    await expect(
      controller.releasePayment('payment-1', {
        environment: Environment.LIVE,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(releasePaymentUseCase.execute).not.toHaveBeenCalled();
  });

  it('maps non-confirmed payments to unprocessable on release', async () => {
    releasePaymentUseCase.execute.mockRejectedValue(
      new PaymentNotConfirmedError('payment-1', 'PENDING'),
    );

    await expect(
      controller.releasePayment('payment-1', {
        environment: Environment.TEST,
        store: { id: 'store-1' },
      } as any),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('maps missing account errors on release', async () => {
    releasePaymentUseCase.execute.mockRejectedValue(
      new AccountNotFoundError('store-1'),
    );

    await expect(
      controller.releasePayment('payment-1', {
        environment: Environment.TEST,
        store: { id: 'store-1' },
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forwards authenticated storeId to the expire use case', async () => {
    expirePaymentUseCase.execute.mockResolvedValue({
      payment: { id: 'payment-1', status: 'EXPIRED' },
      alreadyExpired: false,
    });

    const result = await controller.expirePayment('payment-1', {
      environment: Environment.TEST,
      store: { id: 'store-1' },
      id: 'req-1',
    } as any);

    expect(expirePaymentUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentId: 'payment-1',
      requestId: 'req-1',
    });
    expect(result).toEqual({
      payment: { id: 'payment-1', status: 'EXPIRED' },
    });
  });
});
