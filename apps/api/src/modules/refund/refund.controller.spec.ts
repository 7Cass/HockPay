import 'reflect-metadata';
import { CreateRefundUseCase } from '@hockpay/core';
import { IDEMPOTENCY_KEY } from '../../common/decorators/idempotent.decorator';
import { RefundController } from './refund.controller';

describe('RefundController', () => {
  it('requires an Idempotency-Key for refund creation', () => {
    const metadata = Reflect.getMetadata(
      IDEMPOTENCY_KEY,
      RefundController.prototype.createRefund,
    );

    expect(metadata).toEqual({ required: true });
  });

  it('creates refunds through the transactional idempotency service', async () => {
    const repos = { refundRepository: {} };
    const createRefundUseCase = {
      executeInTransaction: jest.fn().mockResolvedValue({
        refund: {
          id: 'refund-1',
          paymentId: 'payment-1',
          amount: 500,
          feeRefunded: 50,
          reason: 'duplicate',
          status: 'PROCESSED',
          processedAt: new Date('2026-01-01T10:00:00.000Z'),
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        payment: { id: 'payment-1' },
      }),
    };
    const idempotencyService = {
      execute: jest.fn(async (input) => {
        const body = await input.operation(repos);
        return {
          body,
          status: input.responseStatus,
          replayed: false,
        };
      }),
    };
    const response = {
      status: jest.fn(),
      setHeader: jest.fn(),
    };
    const controller = new RefundController(
      createRefundUseCase as unknown as CreateRefundUseCase,
      idempotencyService as any,
    );

    const result = await controller.createRefund(
      {
        paymentId: 'payment-1',
        amount: 500,
        reason: 'duplicate',
      },
      'store-1',
      {
        id: 'req-1',
        method: 'POST',
        path: '/refunds',
        headers: { 'idempotency-key': 'idem-1' },
      } as any,
      response as any,
    );

    expect(idempotencyService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        storeId: 'store-1',
        method: 'POST',
        path: '/refunds',
        responseStatus: 201,
      }),
    );
    expect(createRefundUseCase.executeInTransaction).toHaveBeenCalledWith(
      {
        storeId: 'store-1',
        paymentId: 'payment-1',
        requestId: 'req-1',
        amount: 500,
        reason: 'duplicate',
      },
      repos,
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-idempotency-key',
      'idem-1',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-idempotency-replayed',
      'false',
    );
    expect(result).toMatchObject({
      refund: {
        id: 'refund-1',
        paymentId: 'payment-1',
      },
      payment: { id: 'payment-1' },
    });
  });
});
