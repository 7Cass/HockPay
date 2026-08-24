import { describe, expect, it, vi } from 'vitest';
import { Environment, Payment, PaymentStatus } from '../..';
import { ListPaymentsUseCase } from './list-payments.use-case';

describe('ListPaymentsUseCase', () => {
  it('adds attempt context for payments that share a Pix charge', async () => {
    const firstAttempt = makePayment({
      id: 'payment-failed',
      pixChargeId: 'charge-1',
      status: PaymentStatus.FAILED,
      metadata: {
        origin: 'payment_link',
        paymentLinkId: 'link-1',
      },
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:01:00.000Z'),
    });
    const secondAttempt = makePayment({
      id: 'payment-confirmed',
      pixChargeId: 'charge-1',
      status: PaymentStatus.CONFIRMED,
      metadata: {
        origin: 'payment_link',
        paymentLinkId: 'link-1',
      },
      createdAt: new Date('2026-01-01T10:02:00.000Z'),
      updatedAt: new Date('2026-01-01T10:03:00.000Z'),
    });

    const repository = {
      list: vi.fn().mockResolvedValue({
        payments: [secondAttempt, firstAttempt],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      listByPixChargeIdsAndStoreId: vi.fn().mockResolvedValue([firstAttempt, secondAttempt]),
    };

    const result = await new ListPaymentsUseCase(repository as any).execute({
      storeId: 'store-1',
      environment: Environment.TEST,
    });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        environment: Environment.TEST,
      }),
    );

    expect(repository.listByPixChargeIdsAndStoreId).toHaveBeenCalledWith(
      ['charge-1', 'charge-1'],
      'store-1',
    );
    expect(result.payments.map((payment) => payment.id)).toEqual([
      'payment-confirmed',
      'payment-failed',
    ]);
    expect(result.payments.map((payment) => payment.attemptNumber)).toEqual([2, 1]);
    expect(result.payments.map((payment) => payment.attemptCount)).toEqual([2, 2]);
    expect(result.payments[0].paymentLinkId).toBe('link-1');
    expect(result.payments[0].isLatestAttempt).toBe(true);
  });
});

function makePayment(overrides: Partial<Parameters<typeof Payment.reconstitute>[0]> = {}) {
  return Payment.reconstitute({
    id: 'payment-1',
    storeId: 'store-1',
    amount: 10000,
    fee: 200,
    netAmount: 9800,
    currency: 'BRL',
    status: PaymentStatus.PENDING,
    environment: Environment.TEST,
    totalRefunded: 0,
    expiresAt: new Date('2026-01-01T11:00:00.000Z'),
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  });
}
