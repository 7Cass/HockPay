import { NotFoundException } from '@nestjs/common';
import {
  CreatePaymentUseCase,
  GetPaymentTimelineUseCase,
  GetPaymentUseCase,
  ListPaymentsUseCase,
  PaymentNotFoundError,
  PaymentMethod,
  SimulateCheckoutPaymentUseCase,
} from '@hockpay/core';
import { PaymentController } from './payment.controller';

describe('PaymentController', () => {
  let controller: PaymentController;
  let createPaymentUseCase: { execute: jest.Mock };
  let getPaymentUseCase: { execute: jest.Mock };
  let getPaymentTimelineUseCase: { execute: jest.Mock };
  let listPaymentsUseCase: { execute: jest.Mock };
  let simulatePaymentUseCase: { execute: jest.Mock };

  beforeEach(() => {
    createPaymentUseCase = { execute: jest.fn() };
    getPaymentUseCase = { execute: jest.fn() };
    getPaymentTimelineUseCase = { execute: jest.fn() };
    listPaymentsUseCase = { execute: jest.fn() };
    simulatePaymentUseCase = { execute: jest.fn() };

    controller = new PaymentController(
      createPaymentUseCase as unknown as CreatePaymentUseCase,
      getPaymentUseCase as unknown as GetPaymentUseCase,
      getPaymentTimelineUseCase as unknown as GetPaymentTimelineUseCase,
      listPaymentsUseCase as unknown as ListPaymentsUseCase,
      simulatePaymentUseCase as unknown as SimulateCheckoutPaymentUseCase,
    );
  });

  it('forwards payment method, details, and acquirer id when creating payments', async () => {
    createPaymentUseCase.execute.mockResolvedValue({
      payment: { id: 'payment-1' },
      customerCreated: false,
    });

    const result = await controller.createPayment(
      {
        externalId: 'external-1',
        amount: 1234,
        description: 'Test payment',
        paymentMethod: PaymentMethod.CREDIT_CARD,
        paymentDetails: { installments: 2 },
        acquirerId: 'acquirer-1',
        customer: { document: '12345678901' },
        expiresAt: '2026-01-01T10:30:00.000Z',
        metadata: { source: 'spec' },
      },
      {
        store: { id: 'store-1' },
        environment: 'TEST',
        id: 'req-1',
      } as any,
    );

    expect(createPaymentUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      requestId: 'req-1',
      externalId: 'external-1',
      amount: 1234,
      description: 'Test payment',
      customer: { document: '12345678901' },
      environment: 'TEST',
      paymentMethod: PaymentMethod.CREDIT_CARD,
      paymentDetails: { installments: 2 },
      acquirerId: 'acquirer-1',
      expiresAt: new Date('2026-01-01T10:30:00.000Z'),
      metadata: { source: 'spec' },
    });
    expect(result).toEqual({
      payment: { id: 'payment-1' },
      customerCreated: false,
    });
  });

  it('forwards storeId and paymentId to the timeline use case', async () => {
    getPaymentTimelineUseCase.execute.mockResolvedValue({
      payment: { id: 'payment-1' },
      checkoutSession: null,
      receipt: null,
      refunds: [],
      transactions: [],
      webhookLogs: [
        {
          id: 'log-1',
          configId: 'config-1',
          requestHeaders: {
            'x-hockpay-signature': 'abcdefghijklmnopqrstuvwxyz',
          },
          eventType: 'payment.confirmed',
          payload: {},
          attempt: 1,
          maxAttempts: 5,
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      ],
      timeline: [],
    });

    const result = await controller.getPaymentTimeline('payment-1', {
      store: { id: 'store-1' },
    } as any);

    expect(getPaymentTimelineUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentId: 'payment-1',
    });
    expect(result.webhookLogs[0]).toMatchObject({
      id: 'log-1',
      deliveryId: 'log-1',
      requestHeaders: {
        'x-hockpay-signature': 'abcdefgh...[REDACTED]',
      },
    });
  });

  it('maps PaymentNotFoundError to NotFoundException on timeline lookups', async () => {
    getPaymentTimelineUseCase.execute.mockRejectedValue(
      new PaymentNotFoundError('payment-404'),
    );

    await expect(
      controller.getPaymentTimeline('payment-404', {
        store: { id: 'store-1' },
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
