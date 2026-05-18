import { Withdrawal, WithdrawalStatus } from "@hockpay/core";
import { WithdrawalProcessingJob } from "./withdrawal-processing.job";

describe("WithdrawalProcessingJob", () => {
  it("processes pending withdrawals to completed", async () => {
    const withdrawal = makeWithdrawal();
    const deps = makeDeps([withdrawal]);
    const job = new WithdrawalProcessingJob(
      deps.repository as any,
      deps.markProcessing as any,
      deps.complete as any,
      deps.fail as any,
      deps.recordRetry as any,
    );

    await job.processPendingWithdrawals();

    expect(deps.markProcessing.execute).toHaveBeenCalledWith(
      expect.objectContaining({ withdrawalId: withdrawal.id }),
    );
    expect(deps.complete.execute).toHaveBeenCalledWith(
      expect.objectContaining({ withdrawalId: withdrawal.id }),
    );
    expect(deps.fail.execute).not.toHaveBeenCalled();
  });

  it("records a retry for technical processor failures before final attempt", async () => {
    const withdrawal = makeWithdrawal();
    const deps = makeDeps([withdrawal], { attemptsAfterMark: 1 });
    const job = new FailingWithdrawalProcessingJob(
      deps.repository as any,
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
        error: "processor unavailable",
      }),
    );
    expect(deps.fail.execute).not.toHaveBeenCalled();
  });

  it("fails after the final technical attempt", async () => {
    const withdrawal = makeWithdrawal();
    const deps = makeDeps([withdrawal], { attemptsAfterMark: 3 });
    const job = new FailingWithdrawalProcessingJob(
      deps.repository as any,
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
        reason: "processor unavailable",
      }),
    );
  });
});

class FailingWithdrawalProcessingJob extends WithdrawalProcessingJob {
  protected override async simulatePayout(): Promise<void> {
    throw new Error("processor unavailable");
  }
}

function makeDeps(
  withdrawals: Withdrawal[],
  options: { attemptsAfterMark?: number } = {},
) {
  return {
    repository: {
      findProcessablePending: jest.fn().mockResolvedValue(withdrawals),
    },
    markProcessing: {
      execute: jest.fn().mockImplementation(({ withdrawalId }) => {
        const withdrawal = withdrawals.find(
          (item) => item.id === withdrawalId,
        )!;
        const object = withdrawal.toObject();
        return Promise.resolve({
          withdrawal: {
            ...object,
            status: WithdrawalStatus.PROCESSING,
            processingAttempts:
              options.attemptsAfterMark ?? object.processingAttempts + 1,
          },
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

function makeWithdrawal(): Withdrawal {
  return Withdrawal.reconstitute({
    id: "withdrawal-1",
    accountId: "account-1",
    bankAccountId: "bank-1",
    amount: 10_000,
    fee: 199,
    netAmount: 9_801,
    status: WithdrawalStatus.PENDING,
    processingAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
