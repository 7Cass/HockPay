import { Logger } from '@nestjs/common';
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

    const storeRepository = {
      listActiveApproved: jest.fn().mockResolvedValue([
        { id: 'store-1', settlementDays: 30 },
        { id: 'store-2', settlementDays: 7 },
      ]),
    };
    const paymentRepository = {
      findConfirmedForSettlement: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'payment-1' }, { id: 'payment-2' }])
        .mockResolvedValueOnce([{ id: 'payment-3' }]),
    };
    const releasePaymentUseCase = {
      execute: jest.fn().mockResolvedValue({ alreadyReleased: false }),
    };
    const job = new SettlementJob(
      storeRepository as never,
      paymentRepository as never,
      releasePaymentUseCase as never,
    );

    await job.processSettlements();

    expect(storeRepository.listActiveApproved).toHaveBeenCalledTimes(1);
    expect(paymentRepository.findConfirmedForSettlement).toHaveBeenNthCalledWith(
      1,
      'store-1',
      settlementCutoff(30),
      100,
    );
    expect(paymentRepository.findConfirmedForSettlement).toHaveBeenNthCalledWith(
      2,
      'store-2',
      settlementCutoff(7),
      100,
    );
    expect(releasePaymentUseCase.execute).toHaveBeenCalledTimes(3);
  });

  it('does not call release when no payments are eligible', async () => {
    const storeRepository = {
      listActiveApproved: jest.fn().mockResolvedValue([{ id: 'store-1', settlementDays: 30 }]),
    };
    const paymentRepository = {
      findConfirmedForSettlement: jest.fn().mockResolvedValue([]),
    };
    const releasePaymentUseCase = { execute: jest.fn() };
    const job = new SettlementJob(
      storeRepository as never,
      paymentRepository as never,
      releasePaymentUseCase as never,
    );

    await job.processSettlements();

    expect(releasePaymentUseCase.execute).not.toHaveBeenCalled();
  });

  it('continues processing later payments when one release fails', async () => {
    const storeRepository = {
      listActiveApproved: jest.fn().mockResolvedValue([{ id: 'store-1', settlementDays: 30 }]),
    };
    const paymentRepository = {
      findConfirmedForSettlement: jest
        .fn()
        .mockResolvedValue([{ id: 'payment-1' }, { id: 'payment-2' }, { id: 'payment-3' }]),
    };
    const releasePaymentUseCase = {
      execute: jest
        .fn()
        .mockResolvedValueOnce({ alreadyReleased: false })
        .mockRejectedValueOnce(new Error('release failed'))
        .mockResolvedValueOnce({ alreadyReleased: false }),
    };
    const job = new SettlementJob(
      storeRepository as never,
      paymentRepository as never,
      releasePaymentUseCase as never,
    );

    await job.processSettlements();

    expect(releasePaymentUseCase.execute).toHaveBeenCalledTimes(3);
  });
});

function settlementCutoff(settlementDays: number): Date {
  const releaseDate = new Date();
  releaseDate.setDate(releaseDate.getDate() - settlementDays);
  return releaseDate;
}
