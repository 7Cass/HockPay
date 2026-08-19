import { describe, expect, it, vi } from "vitest";
import { ReleasePaymentUseCase } from "./release-payment.use-case";
import { Payment } from "../../domain/entities/payment.entity";
import { Account } from "../../domain/entities/account.entity";
import { Refund } from "../../domain/entities/refund.entity";
import { TransactionType } from "../../domain/entities/transaction.entity";
import { Environment } from "../../domain/value-objects/environment.vo";
import { LiveEnvironmentNotAllowedError } from "../../domain/errors/live-environment-not-allowed.error";

describe("ReleasePaymentUseCase", () => {
  function makeRepos(
    payment: Payment,
    account: Account | null,
    refunds: Refund[] = [],
  ) {
    return {
      paymentRepository: {
        findById: vi.fn().mockResolvedValue(payment),
        findByIdForUpdate: vi.fn().mockResolvedValue(payment),
        findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
        findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(payment),
        update: vi.fn(),
      },
      refundRepository: {
        findByPaymentId: vi.fn().mockResolvedValue(refunds),
      },
      accountRepository: {
        findByStoreId: vi.fn().mockResolvedValue(account),
        findByStoreIdForUpdate: vi.fn().mockResolvedValue(account),
        update: vi.fn(),
      },
      transactionRepository: {
        save: vi.fn(),
      },
      bankAccountRepository: {},
      outboxWriter: {
        save: vi.fn(),
      },
      receiptRepository: {},
      storeRepository: {},
      customerRepository: {},
    };
  }

  it("releases only the remaining net amount after processed refunds", async () => {
    const payment = Payment.create({
      storeId: "store-1",
      amount: 10_000,
      fee: 1_000,
      netAmount: 9_000,
      expiresAt: new Date(Date.now() + 60_000),
    });
    payment.confirm();
    payment.addRefund(2_500);

    const refund = Refund.create({
      paymentId: payment.id,
      amount: 2_500,
      feeRefunded: 250,
    });
    refund.process();

    const account = Account.reconstitute({
      id: "account-1",
      storeId: "store-1",
      available: 0,
      pending: 6_750,
      blocked: 0,
      currency: "BRL",
      updatedAt: new Date(),
    });

    const repos = makeRepos(payment, account, [refund]);

    const useCase = new ReleasePaymentUseCase({
      execute: async (work: any) => work(repos),
    } as any);

    const result = await useCase.execute({ paymentId: payment.id });

    expect(result.account.pending).toBe(0);
    expect(result.account.available).toBe(6_750);
    const transaction = repos.transactionRepository.save.mock.calls[0][0];
    expect(transaction.type).toBe(TransactionType.PAYMENT_RELEASED);
    expect(transaction.amount).toBe(7_500);
    expect(transaction.fee).toBe(750);
    expect(transaction.netAmount).toBe(6_750);
    expect(transaction.balanceAfter).toBe(6_750);
    expect(transaction.referenceType).toBe("PAYMENT");
    expect(transaction.referenceId).toBe(payment.id);
    expect(repos.paymentRepository.findByIdForUpdate).toHaveBeenCalledWith(
      payment.id,
    );
    expect(repos.accountRepository.findByStoreIdForUpdate).toHaveBeenCalledWith(
      payment.storeId,
    );
  });

  it("returns an already released payment without side effects", async () => {
    const payment = Payment.create({
      storeId: "store-1",
      amount: 10_000,
      fee: 1_000,
      netAmount: 9_000,
      expiresAt: new Date(Date.now() + 60_000),
    });
    payment.confirm();
    payment.release();

    const account = Account.reconstitute({
      id: "account-1",
      storeId: "store-1",
      available: 9_000,
      pending: 0,
      blocked: 0,
      currency: "BRL",
      updatedAt: new Date(),
    });

    const repos = makeRepos(payment, account);
    const useCase = new ReleasePaymentUseCase({
      execute: async (work: any) => work(repos),
    } as any);

    const result = await useCase.execute({ paymentId: payment.id });

    expect(result.alreadyReleased).toBe(true);
    expect(result.payment.id).toBe(payment.id);
    expect(result.account.id).toBe(account.id);
    expect(repos.paymentRepository.findByIdForUpdate).toHaveBeenCalledWith(
      payment.id,
    );
    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(repos.accountRepository.update).not.toHaveBeenCalled();
    expect(repos.transactionRepository.save).not.toHaveBeenCalled();
    expect(repos.outboxWriter.save).not.toHaveBeenCalled();
    expect(repos.refundRepository.findByPaymentId).not.toHaveBeenCalled();
  });

  it("uses store-scoped lookup when storeId is provided", async () => {
    const payment = Payment.create({
      storeId: "store-1",
      amount: 10_000,
      fee: 1_000,
      netAmount: 9_000,
      expiresAt: new Date(Date.now() + 60_000),
    });
    payment.confirm();

    const account = Account.reconstitute({
      id: "account-1",
      storeId: "store-1",
      available: 0,
      pending: 9_000,
      blocked: 0,
      currency: "BRL",
      updatedAt: new Date(),
    });

    const repos = makeRepos(payment, account);
    const useCase = new ReleasePaymentUseCase({
      execute: async (work: any) => work(repos),
    } as any);

    await useCase.execute({
      storeId: "store-1",
      paymentId: payment.id,
    });

    expect(
      repos.paymentRepository.findByIdAndStoreIdForUpdate,
    ).toHaveBeenCalledWith(payment.id, "store-1");
    expect(repos.paymentRepository.findById).not.toHaveBeenCalled();
    expect(repos.paymentRepository.findByIdForUpdate).not.toHaveBeenCalled();
  });

  it("refuses to release a LIVE payment unless the settlement job opts in", async () => {
    const payment = Payment.create({
      storeId: "store-1",
      amount: 10_000,
      fee: 1_000,
      netAmount: 9_000,
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.LIVE,
    });
    payment.confirm();
    const account = Account.reconstitute({
      id: "account-1",
      storeId: "store-1",
      available: 0,
      pending: 9_000,
      blocked: 0,
      currency: "BRL",
      updatedAt: new Date(),
    });
    const repos = makeRepos(payment, account);
    const useCase = new ReleasePaymentUseCase({
      execute: async (work: any) => work(repos),
    } as any);

    await expect(
      useCase.execute({
        storeId: "store-1",
        paymentId: payment.id,
      }),
    ).rejects.toBeInstanceOf(LiveEnvironmentNotAllowedError);

    expect(account.pending).toBe(9_000);
    expect(repos.paymentRepository.update).not.toHaveBeenCalled();

    await useCase.execute({
      storeId: "store-1",
      paymentId: payment.id,
      allowLiveEnvironment: true,
    });

    expect(payment.isReleased()).toBe(true);
    expect(account.available).toBe(9_000);
  });
});
