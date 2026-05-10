import { describe, expect, it, vi } from 'vitest';
import {
  Environment,
  PaymentMethod,
  PaymentStatus,
} from '@hockpay/core';
import { PaymentRepository } from './payment.repository';

describe('PaymentRepository', () => {
  it('rehydrates refund and acquirer fields from persistence', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-01T00:01:00.000Z');
    const expiresAt = new Date('2026-01-01T01:00:00.000Z');
    const paymentDetails = {
      installments: 3,
      authorizationCode: 'auth-123',
    };

    const prisma = {
      payment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'payment-1',
          storeId: 'store-1',
          customerId: null,
          externalId: 'external-1',
          amount: 10_000,
          fee: 1_000,
          netAmount: 9_000,
          currency: 'BRL',
          description: 'Order #1',
          payerName: 'Customer',
          payerDocument: '52998224725',
          payerEmail: 'customer@example.com',
          status: PaymentStatus.CONFIRMED,
          environment: Environment.TEST,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          paymentDetails,
          acquirerId: 'acquirer-1',
          totalRefunded: 2_500,
          pixQrCode: null,
          pixCopyPaste: null,
          pixTxId: null,
          expiresAt,
          paidAt: null,
          releasedAt: null,
          failedReason: null,
          metadata: null,
          createdAt,
          updatedAt,
        }),
      },
    };

    const repository = new PaymentRepository(prisma as any);

    const payment = await repository.findById('payment-1');

    expect(payment?.totalRefunded).toBe(2_500);
    expect(payment?.paymentMethod).toBe(PaymentMethod.CREDIT_CARD);
    expect(payment?.paymentDetails).toEqual(paymentDetails);
    expect(payment?.acquirerId).toBe('acquirer-1');
  });
});
