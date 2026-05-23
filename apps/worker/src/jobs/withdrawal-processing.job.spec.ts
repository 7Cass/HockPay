import { Withdrawal, WithdrawalObject, WithdrawalStatus } from '@hockpay/core';
import { WithdrawalProcessingJob } from './withdrawal-processing.job';

describe('WithdrawalProcessingJob', () => {
  it('claims processable withdrawals and completes them', async () => {
    const withdrawal = makeWithdrawal();
    const deps = makeDeps([withdrawal]);
    const job = new WithdrawalProcessingJob(
      deps.claim as any,
      deps.markProcessing as any,
      deps.complete as any,
      deps.fail as any,
      deps.recordRetry as any,
    );

    await job.processPendingWithdrawals();

    expect(deps.claim.execute).toHaveBeenCalledWith({ limit: 50 });
    expect(deps.markProcessing.execute).not.toHaveBeenCalled();
    expect(deps.complete.execute).toHaveBeenCalledWith(
      expect.objectContaining({ withdrawalId: withdrawal.id }),
    );
    expect(deps.fail.execute).not.toHaveBeenCalled();
  });

  it('records a retry for technical processor failures before final attempt', async () => {
    const withdrawal = makeWithdrawal();
    const deps = makeDeps([withdrawal], { claimedAttempts: 1 });
    const job = new FailingWithdrawalProcessingJob(
      deps.claim as any,
      deps.markProcessing as any,
      deps.complete as any,
      deps.fail as any,
      deps.recordRetry as any,
    );

    await job.processPendingWithdrawals();

    expect(deps.complete.execute).not.toHaveBeenCalled();
    expect(deps.recordRetry.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        withdrawalId: withdrawal.id,
        error: 'processor unavailable',
      }),
    );
    expect(deps.fail.execute).not.toHaveBeenCalled();
  });

  it('fails after the final technical attempt', async () => {
    const withdrawal = makeWithdrawal();
    const deps = makeDeps([withdrawal], { claimedAttempts: 3 });
    const job = new FailingWithdrawalProcessingJob(
      deps.claim as any,
      deps.markProcessing as any,
      deps.complete as any,
      deps.fail as any,
      deps.recordRetry as any,
    );

    await job.processPendingWithdrawals();

    expect(deps.recordRetry.execute).not.toHaveBeenCalled();
    expect(deps.fail.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        withdrawalId: withdrawal.id,
        reason: 'processor unavailable',
      }),
    );
  });

  it('does not payout or complete when legacy mark returns alreadyProcessing', async () => {
    const withdrawal = makeWithdrawal();
    const deps = makeDeps([]);
    deps.markProcessing.execute.mockResolvedValueOnce({
      withdrawal: makeProcessingObject(withdrawal, 1),
      alreadyProcessing: true,
    });
    const job = new WithdrawalProcessingJob(
      deps.claim as any,
      deps.markProcessing as any,
      deps.complete as any,
      deps.fail as any,
      deps.recordRetry as any,
    );

    await job.processWithdrawal(withdrawal.id, 'request-1');

    expect(deps.markProcessing.execute).toHaveBeenCalledWith({
      withdrawalId: withdrawal.id,
      requestId: 'request-1',
    });
    expect(deps.complete.execute).not.toHaveBeenCalled();
    expect(deps.fail.execute).not.toHaveBeenCalled();
    expect(deps.recordRetry.execute).not.toHaveBeenCalled();
  });
});

class FailingWithdrawalProcessingJob extends WithdrawalProcessingJob {
  protected override async simulatePayout(): Promise<void> {
    throw new Error('processor unavailable');
  }
}

function makeDeps(
  withdrawals: Withdrawal[],
  options: { claimedAttempts?: number; attemptsAfterMark?: number } = {},
) {
  return {
    claim: {
      execute: jest.fn().mockResolvedValue({
        withdrawals: withdrawals.map((withdrawal) =>
          makeProcessingObject(
            withdrawal,
            options.claimedAttempts ?? withdrawal.toObject().processingAttempts + 1,
          ),
        ),
      }),
    },
    markProcessing: {
      execute: jest.fn().mockImplementation(({ withdrawalId }) => {
        const withdrawal = withdrawals.find((item) => item.id === withdrawalId)!;
        return Promise.resolve({
          withdrawal: makeProcessingObject(
            withdrawal,
            options.attemptsAfterMark ?? withdrawal.toObject().processingAttempts + 1,
          ),
          alreadyProcessing: false,
        });
      }),
    },
    complete: {
      execute: jest.fn().mockResolvedValue({}),
    },
    fail: {
      execute: jest.fn().mockResolvedValue({}),
    },
    recordRetry: {
      execute: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeProcessingObject(
  withdrawal: Withdrawal,
  processingAttempts: number,
): WithdrawalObject {
  return {
    ...withdrawal.toObject(),
    status: WithdrawalStatus.PROCESSING,
    processingAttempts,
    nextProcessAt: undefined,
    lastProcessingError: undefined,
  };
}

function makeWithdrawal(): Withdrawal {
  return Withdrawal.reconstitute({
    id: 'withdrawal-1',
    accountId: 'account-1',
    bankAccountId: 'bank-1',
    amount: 10_000,
    fee: 199,
    netAmount: 9_801,
    status: WithdrawalStatus.PENDING,
    processingAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
