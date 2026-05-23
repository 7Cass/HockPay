import { Logger } from '@nestjs/common';
import { PaymentStatus } from '@hockpay/core';
import { SettlementJob } from './settlement.job';

describe('SettlementJob', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('queries active approved stores and releases each eligible payment', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-31T12:00:00.000Z'));

    const prisma = {
      store: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'store-1', settlementDays: 30 },
          { id: 'store-2', settlementDays: 7 },
        ]),
      },
      payment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'payment-1' }, { id: 'payment-2' }])
          .mockResolvedValueOnce([{ id: 'payment-3' }]),
      },
    };
    const releasePaymentUseCase = {
      execute: jest.fn().mockResolvedValue({ alreadyReleased: false }),
    };
    const job = new SettlementJob(prisma as any, releasePaymentUseCase as any);

    await job.processSettlements();

    expect(prisma.store.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        isApproved: true,
      },
    });
    expect(prisma.payment.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        storeId: 'store-1',
        status: PaymentStatus.CONFIRMED,
        paidAt: { lte: settlementCutoff(30) },
      },
      take: 100,
    });
    expect(prisma.payment.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        storeId: 'store-2',
        status: PaymentStatus.CONFIRMED,
        paidAt: { lte: settlementCutoff(7) },
      },
      take: 100,
    });
    expect(releasePaymentUseCase.execute).toHaveBeenCalledTimes(3);
    expect(releasePaymentUseCase.execute).toHaveBeenNthCalledWith(1, {
      storeId: 'store-1',
      paymentId: 'payment-1',
      requestId: 'worker:settlement:payment-1',
    });
    expect(releasePaymentUseCase.execute).toHaveBeenNthCalledWith(2, {
      storeId: 'store-1',
      paymentId: 'payment-2',
      requestId: 'worker:settlement:payment-2',
    });
    expect(releasePaymentUseCase.execute).toHaveBeenNthCalledWith(3, {
      storeId: 'store-2',
      paymentId: 'payment-3',
      requestId: 'worker:settlement:payment-3',
    });
  });

  it('does not call release when no payments are eligible', async () => {
    const prisma = {
      store: {
        findMany: jest.fn().mockResolvedValue([{ id: 'store-1', settlementDays: 30 }]),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const releasePaymentUseCase = {
      execute: jest.fn(),
    };
    const job = new SettlementJob(prisma as any, releasePaymentUseCase as any);

    await job.processSettlements();

    expect(releasePaymentUseCase.execute).not.toHaveBeenCalled();
  });

  it('continues processing later payments when one release fails', async () => {
    const prisma = {
      store: {
        findMany: jest.fn().mockResolvedValue([{ id: 'store-1', settlementDays: 30 }]),
      },
      payment: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'payment-1' }, { id: 'payment-2' }, { id: 'payment-3' }]),
      },
    };
    const releasePaymentUseCase = {
      execute: jest
        .fn()
        .mockResolvedValueOnce({ alreadyReleased: false })
        .mockRejectedValueOnce(new Error('release failed'))
        .mockResolvedValueOnce({ alreadyReleased: false }),
    };
    const job = new SettlementJob(prisma as any, releasePaymentUseCase as any);

    await job.processSettlements();

    expect(releasePaymentUseCase.execute).toHaveBeenCalledTimes(3);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Failed to release payment payment-2 requestId=worker:settlement:payment-2:',
      expect.any(Error),
    );
  });
});

function settlementCutoff(settlementDays: number): Date {
  const releaseDate = new Date();
  releaseDate.setDate(releaseDate.getDate() - settlementDays);
  return releaseDate;
}
