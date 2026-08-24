import { describe, expect, it, vi } from 'vitest';
import { TransactionType } from '@hockpay/core';
import { TransactionRepository } from './transaction.repository';

describe('TransactionRepository', () => {
  it('sums net amounts for financial dashboard metrics', async () => {
    const prisma = {
      transaction: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: {
            netAmount: 7855,
          },
        }),
      },
    };
    const repository = new TransactionRepository(prisma as any);
    const startDate = new Date('2026-05-01T00:00:00.000Z');
    const endDate = new Date('2026-05-20T23:59:59.999Z');

    const total = await repository.sumByTypeAndDateRange(
      'account-1',
      TransactionType.PAYMENT_RECEIVED,
      startDate,
      endDate,
    );

    expect(total).toBe(7855);
    expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
      where: {
        accountId: 'account-1',
        type: TransactionType.PAYMENT_RECEIVED,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        netAmount: true,
      },
    });
  });
});
