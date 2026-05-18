import { describe, expect, it } from "vitest";
import { Account } from "../../domain/entities/account.entity";
import {
  BankAccount,
  PixKeyType,
} from "../../domain/entities/bank-account.entity";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import { Store } from "../../domain/entities/store.entity";
import {
  Transaction,
  TransactionType,
} from "../../domain/entities/transaction.entity";
import {
  Withdrawal,
  WithdrawalStatus,
} from "../../domain/entities/withdrawal.entity";
import { BankAccountNotFoundError } from "../../domain/errors/bank-account-not-found.error";
import { BankAccountNotVerifiedError } from "../../domain/errors/bank-account-not-verified.error";
import { InsufficientWithdrawalBalanceError } from "../../domain/errors/insufficient-withdrawal-balance.error";
import { InvalidWithdrawalAmountError } from "../../domain/errors/invalid-withdrawal-amount.error";
import { WithdrawalLimitExceededError } from "../../domain/errors/withdrawal-limit-exceeded.error";
import {
  IUnitOfWork,
  ITransactedRepositories,
} from "../../domain/repositories/unit-of-work.interface";
import { CompleteWithdrawalUseCase } from "./complete-withdrawal.use-case";
import { CreateWithdrawalUseCase } from "./create-withdrawal.use-case";
import { FailWithdrawalUseCase } from "./fail-withdrawal.use-case";

describe("withdrawal use cases", () => {
  it("creates a valid withdrawal and reserves available balance", async () => {
    const fixture = makeFixture({ available: 20_000 });
    const useCase = new CreateWithdrawalUseCase(fixture.unitOfWork);

    const result = await useCase.execute({
      storeId: fixture.store.id,
      bankAccountId: fixture.bankAccount.id,
      amount: 10_000,
      requestId: "req-1",
    });

    expect(result.withdrawal.status).toBe(WithdrawalStatus.PENDING);
    expect(result.withdrawal.fee).toBe(199);
    expect(result.withdrawal.netAmount).toBe(9_801);
    expect(result.account.available).toBe(10_000);
    expect(result.account.blocked).toBe(10_000);
    expect(fixture.transactions).toHaveLength(1);
    expect(fixture.transactions[0].type).toBe(
      TransactionType.WITHDRAWAL_RESERVED,
    );
    expect(fixture.outbox.map((event) => event.eventType)).toEqual([
      "withdrawal.created",
    ]);
  });

  it("rejects insufficient balance", async () => {
    const fixture = makeFixture({ available: 5_000 });
    const useCase = new CreateWithdrawalUseCase(fixture.unitOfWork);

    await expect(
      useCase.execute({
        storeId: fixture.store.id,
        bankAccountId: fixture.bankAccount.id,
        amount: 10_000,
      }),
    ).rejects.toBeInstanceOf(InsufficientWithdrawalBalanceError);
  });

  it("rejects unverified or foreign bank accounts", async () => {
    const unverified = makeFixture({ bankAccountVerified: false });
    await expect(
      new CreateWithdrawalUseCase(unverified.unitOfWork).execute({
        storeId: unverified.store.id,
        bankAccountId: unverified.bankAccount.id,
        amount: 10_000,
      }),
    ).rejects.toBeInstanceOf(BankAccountNotVerifiedError);

    const foreign = makeFixture({ bankAccountStoreId: "other-store" });
    await expect(
      new CreateWithdrawalUseCase(foreign.unitOfWork).execute({
        storeId: foreign.store.id,
        bankAccountId: foreign.bankAccount.id,
        amount: 10_000,
      }),
    ).rejects.toBeInstanceOf(BankAccountNotFoundError);
  });

  it("applies amount and daily limits", async () => {
    const fixture = makeFixture();
    const useCase = new CreateWithdrawalUseCase(fixture.unitOfWork);

    await expect(
      useCase.execute({
        storeId: fixture.store.id,
        bankAccountId: fixture.bankAccount.id,
        amount: 999,
      }),
    ).rejects.toBeInstanceOf(InvalidWithdrawalAmountError);

    fixture.dailyCount = 10;
    await expect(
      useCase.execute({
        storeId: fixture.store.id,
        bankAccountId: fixture.bankAccount.id,
        amount: 10_000,
      }),
    ).rejects.toBeInstanceOf(WithdrawalLimitExceededError);
  });

  it("completes a withdrawal and deducts blocked balance", async () => {
    const fixture = makeFixture({ available: 20_000 });
    const created = await new CreateWithdrawalUseCase(
      fixture.unitOfWork,
    ).execute({
      storeId: fixture.store.id,
      bankAccountId: fixture.bankAccount.id,
      amount: 10_000,
    });

    const result = await new CompleteWithdrawalUseCase(
      fixture.unitOfWork,
    ).execute({
      withdrawalId: created.withdrawal.id,
      storeId: fixture.store.id,
      pixE2eId: "E2E-test",
    });

    expect(result.withdrawal.status).toBe(WithdrawalStatus.COMPLETED);
    expect(result.withdrawal.pixE2eId).toBe("E2E-test");
    expect(result.account.available).toBe(10_000);
    expect(result.account.blocked).toBe(0);
    expect(fixture.transactions.map((tx) => tx.type)).toEqual([
      TransactionType.WITHDRAWAL_RESERVED,
      TransactionType.WITHDRAWAL_SENT,
    ]);
  });

  it("fails a withdrawal and returns blocked balance to available", async () => {
    const fixture = makeFixture({ available: 20_000 });
    const created = await new CreateWithdrawalUseCase(
      fixture.unitOfWork,
    ).execute({
      storeId: fixture.store.id,
      bankAccountId: fixture.bankAccount.id,
      amount: 10_000,
    });

    const result = await new FailWithdrawalUseCase(fixture.unitOfWork).execute({
      withdrawalId: created.withdrawal.id,
      storeId: fixture.store.id,
      reason: "bank rejected",
    });

    expect(result.withdrawal.status).toBe(WithdrawalStatus.FAILED);
    expect(result.withdrawal.failedReason).toBe("bank rejected");
    expect(result.account.available).toBe(20_000);
    expect(result.account.blocked).toBe(0);
    expect(fixture.transactions.at(-1)?.type).toBe(
      TransactionType.WITHDRAWAL_REVERSED,
    );
  });
});

function makeFixture(
  options: {
    available?: number;
    bankAccountVerified?: boolean;
    bankAccountStoreId?: string;
  } = {},
) {
  const store = Store.reconstitute({
    id: "store-1",
    merchantId: "merchant-1",
    name: "Store",
    slug: "store",
    isActive: true,
    isApproved: true,
    settlementDays: 1,
    feePercent: 1.5,
    feeFixed: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const account = Account.reconstitute({
    id: "account-1",
    storeId: store.id,
    available: options.available ?? 100_000,
    pending: 0,
    blocked: 0,
    currency: "BRL",
    updatedAt: new Date(),
  });
  const bankAccount = BankAccount.reconstitute({
    id: "bank-1",
    storeId: options.bankAccountStoreId ?? store.id,
    pixKey: "12345678901",
    pixKeyType: PixKeyType.CPF,
    holderName: "Merchant",
    holderDocument: "12345678901",
    isDefault: true,
    isVerified: options.bankAccountVerified ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const withdrawals = new Map<string, Withdrawal>();
  const transactions: Transaction[] = [];
  const outbox: OutboxEvent[] = [];
  let dailyAmount = 0;
  let dailyCount = 0;

  const repos = {
    storeRepository: {
      findById: async (id: string) => (id === store.id ? store : null),
    },
    accountRepository: {
      findByStoreId: async (storeId: string) =>
        storeId === store.id ? account : null,
      findById: async (id: string) => (id === account.id ? account : null),
      update: async () => undefined,
    },
    bankAccountRepository: {
      findById: async (id: string) =>
        id === bankAccount.id ? bankAccount : null,
    },
    withdrawalRepository: {
      save: async (withdrawal: Withdrawal) => {
        withdrawals.set(withdrawal.id, withdrawal);
      },
      update: async (withdrawal: Withdrawal) => {
        withdrawals.set(withdrawal.id, withdrawal);
      },
      findById: async (id: string) => withdrawals.get(id) ?? null,
      findByIdAndAccountId: async (id: string, accountId: string) => {
        const withdrawal = withdrawals.get(id);
        return withdrawal?.accountId === accountId ? withdrawal : null;
      },
      countCreatedInRange: async () => dailyCount,
      sumAmountCreatedInRange: async () => dailyAmount,
    },
    transactionRepository: {
      save: async (transaction: Transaction) => {
        transactions.push(transaction);
      },
    },
    outboxWriter: {
      save: async (event: OutboxEvent) => {
        outbox.push(event);
      },
    },
  } as unknown as ITransactedRepositories;

  const unitOfWork: IUnitOfWork = {
    execute: async (work) => work(repos),
  };

  return {
    store,
    account,
    bankAccount,
    withdrawals,
    transactions,
    outbox,
    unitOfWork,
    get dailyAmount() {
      return dailyAmount;
    },
    set dailyAmount(value: number) {
      dailyAmount = value;
    },
    get dailyCount() {
      return dailyCount;
    },
    set dailyCount(value: number) {
      dailyCount = value;
    },
  };
}
