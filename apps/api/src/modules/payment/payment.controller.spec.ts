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

function makeResponse() {
  return {
    status: jest.fn(),
    setHeader: jest.fn(),
  };
}

describe('PaymentController', () => {
  let controller: PaymentController;
  let createPaymentUseCase: {
    execute: jest.Mock;
    executeInTransaction: jest.Mock;
    scheduleExpirationAfterCommit: jest.Mock;
  };
  let getPaymentUseCase: { execute: jest.Mock };
  let getPaymentTimelineUseCase: { execute: jest.Mock };
  let listPaymentsUseCase: { execute: jest.Mock };
  let simulatePaymentUseCase: { execute: jest.Mock };
  let idempotencyService: { execute: jest.Mock };
  let transactedRepos: Record<string, unknown>;

  beforeEach(() => {
    transactedRepos = { paymentRepository: {} };
    createPaymentUseCase = {
      execute: jest.fn(),
      executeInTransaction: jest.fn(),
      scheduleExpirationAfterCommit: jest.fn(),
    };
    getPaymentUseCase = { execute: jest.fn() };
    getPaymentTimelineUseCase = { execute: jest.fn() };
    listPaymentsUseCase = { execute: jest.fn() };
    simulatePaymentUseCase = { execute: jest.fn() };
    idempotencyService = {
      execute: jest.fn(async (input) => {
        const body = await input.operation(transactedRepos);
        return {
          body,
          status: input.responseStatus,
          replayed: false,
        };
      }),
    };

    controller = new PaymentController(
      createPaymentUseCase as unknown as CreatePaymentUseCase,
      getPaymentUseCase as unknown as GetPaymentUseCase,
      getPaymentTimelineUseCase as unknown as GetPaymentTimelineUseCase,
      listPaymentsUseCase as unknown as ListPaymentsUseCase,
      simulatePaymentUseCase as unknown as SimulateCheckoutPaymentUseCase,
      idempotencyService as any,
    );
  });

  it('forwards payment method, details, and acquirer id when creating payments', async () => {
    createPaymentUseCase.executeInTransaction.mockResolvedValue({
      payment: { id: 'payment-1' },
      customerCreated: false,
    });

    const res = makeResponse();

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
        method: 'POST',
        path: '/payments',
        headers: { 'idempotency-key': 'idem-1' },
      } as any,
      res as any,
    );

    const expectedInput = {
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
    };

    expect(idempotencyService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        storeId: 'store-1',
        method: 'POST',
        path: '/payments',
        responseStatus: 201,
      }),
    );
    expect(createPaymentUseCase.executeInTransaction).toHaveBeenCalledWith(
      expectedInput,
      transactedRepos,
    );
    expect(
      createPaymentUseCase.scheduleExpirationAfterCommit,
    ).toHaveBeenCalledWith(expectedInput, {
      payment: { id: 'payment-1' },
      customerCreated: false,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.setHeader).toHaveBeenCalledWith('x-idempotency-key', 'idem-1');
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-idempotency-replayed',
      'false',
    );
    expect(result).toEqual({
      payment: { id: 'payment-1' },
      customerCreated: false,
    });
  });

  it('does not schedule expiration again when idempotency replays a payment response', async () => {
    idempotencyService.execute.mockResolvedValueOnce({
      body: {
        payment: { id: 'payment-1' },
        customerCreated: false,
      },
      status: 201,
      replayed: true,
    });
    const res = makeResponse();

    const result = await controller.createPayment(
      {
        amount: 1234,
        customer: { document: '12345678901' },
      },
      {
        store: { id: 'store-1' },
        environment: 'TEST',
        id: 'req-1',
        method: 'POST',
        path: '/payments',
        headers: { 'idempotency-key': 'idem-1' },
      } as any,
      res as any,
    );

    expect(createPaymentUseCase.executeInTransaction).not.toHaveBeenCalled();
    expect(
      createPaymentUseCase.scheduleExpirationAfterCommit,
    ).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-idempotency-replayed',
      'true',
    );
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
