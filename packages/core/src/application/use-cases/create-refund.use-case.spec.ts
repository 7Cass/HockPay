import { describe, expect, it, vi } from 'vitest';
import { CreateRefundUseCase } from './create-refund.use-case';
import { Payment } from '../../domain/entities/payment.entity';
import { Account } from '../../domain/entities/account.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { RefundStatus } from '../../domain/entities/refund.entity';
import { TransactionType } from '../../domain/entities/transaction.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';

describe('CreateRefundUseCase', () => {
  function createConfirmedPayment(): Payment {
    const payment = Payment.create({
      storeId: 'store-1',
      amount: 10_000,
      fee: 1_000,
      netAmount: 9_000,
      expiresAt: new Date(Date.now() + 60_000),
    });
    payment.confirm();
    return payment;
  }

  function createAccount(): Account {
    return Account.reconstitute({
      id: 'account-1',
      storeId: 'store-1',
      available: 0,
      pending: 9_000,
      blocked: 0,
      currency: 'BRL',
      updatedAt: new Date(),
    });
  }

  function createUseCase(payment: Payment, account: Account | null = createAccount()) {
    const repos = {
      paymentRepository: {
        findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(payment),
        update: vi.fn(),
      },
      refundRepository: {
        save: vi.fn(),
      },
      accountRepository: {
        findByStoreIdAndEnvironmentForUpdate: vi.fn().mockResolvedValue(account),
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

    const unitOfWork = {
      execute: vi.fn(async (work: any) => work(repos)),
    };

    return {
      useCase: new CreateRefundUseCase(unitOfWork as any),
      repos,
      account,
      unitOfWork,
    };
  }

  it('deducts the proportional net amount from pending for a partial CONFIRMED refund', async () => {
    const payment = createConfirmedPayment();
    const { useCase, repos, account } = createUseCase(payment);

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
      amount: 2_500,
      reason: 'customer request',
    });

    expect(result.refund.status).toBe(RefundStatus.PROCESSED);
    expect(result.refund.feeRefunded).toBe(250);
    expect(result.refund.processedAt).toBeInstanceOf(Date);
    expect(result.payment.totalRefunded).toBe(2_500);
    expect(result.payment.status).toBe(PaymentStatus.CONFIRMED);
    expect(account?.pending).toBe(6_750);
    expect(account?.available).toBe(0);

    const transaction = repos.transactionRepository.save.mock.calls[0][0];
    expect(transaction.type).toBe(TransactionType.REFUND_DEDUCTED);
    expect(transaction.amount).toBe(2_500);
    expect(transaction.fee).toBe(250);
    expect(transaction.netAmount).toBe(2_250);
    expect(transaction.balanceAfter).toBe(6_750);
    expect(repos.refundRepository.save).toHaveBeenCalledTimes(1);
    expect(repos.paymentRepository.findByIdAndStoreIdForUpdate).toHaveBeenCalledWith(
      payment.id,
      'store-1',
    );
    expect(repos.accountRepository.findByStoreIdAndEnvironmentForUpdate).toHaveBeenCalledWith(
      'store-1',
      Environment.TEST,
    );
    expect(repos.accountRepository.update).toHaveBeenCalledWith(account);
    expect(repos.outboxWriter.save).toHaveBeenCalledTimes(1);
  });

  it('deducts the proportional net amount from available for a partial RELEASED refund', async () => {
    const payment = createConfirmedPayment();
    payment.release();
    const account = Account.reconstitute({
      id: 'account-1',
      storeId: 'store-1',
      available: 9_000,
      pending: 0,
      blocked: 0,
      currency: 'BRL',
      updatedAt: new Date(),
    });
    const { useCase, repos } = createUseCase(payment, account);

    await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
      amount: 2_500,
    });

    expect(account.available).toBe(6_750);
    expect(account.pending).toBe(0);
    const transaction = repos.transactionRepository.save.mock.calls[0][0];
    expect(transaction.netAmount).toBe(2_250);
    expect(transaction.balanceAfter).toBe(6_750);
  });

  it('marks the payment as REFUNDED for a full refund', async () => {
    const payment = createConfirmedPayment();
    const { useCase } = createUseCase(payment);

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
      amount: 10_000,
    });

    expect(result.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(result.payment.totalRefunded).toBe(10_000);
  });

  it('rejects an amount greater than the remaining refundable amount without persisting state', async () => {
    const payment = createConfirmedPayment();
    payment.addRefund(8_000);
    const { useCase, repos } = createUseCase(payment);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: payment.id,
        amount: 2_001,
      }),
    ).rejects.toThrow('Refund amount exceeds remaining refundable amount');

    expect(repos.refundRepository.save).not.toHaveBeenCalled();
    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(repos.accountRepository.update).not.toHaveBeenCalled();
    expect(repos.transactionRepository.save).not.toHaveBeenCalled();
    expect(repos.outboxWriter.save).not.toHaveBeenCalled();
    expect(payment.totalRefunded).toBe(8_000);
  });

  it('fails inside the unit of work when the account is missing', async () => {
    const payment = createConfirmedPayment();
    const { useCase, repos, unitOfWork } = createUseCase(payment, null);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: payment.id,
        amount: 2_500,
      }),
    ).rejects.toThrow('Account not found');

    expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
    expect(repos.refundRepository.save).not.toHaveBeenCalled();
    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(repos.transactionRepository.save).not.toHaveBeenCalled();
  });

  it('refuses a TEST caller refunding a LIVE payment without touching the ledger', async () => {
    const payment = Payment.create({
      storeId: 'store-1',
      amount: 10_000,
      fee: 1_000,
      netAmount: 9_000,
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.LIVE,
    });
    payment.confirm();
    const { useCase, repos, account } = createUseCase(payment);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: payment.id,
        amount: 2_500,
        callerEnvironment: Environment.TEST,
      }),
    ).rejects.toBeInstanceOf(LiveEnvironmentNotAllowedError);

    expect(account?.pending).toBe(9_000);
    expect(repos.refundRepository.save).not.toHaveBeenCalled();
    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(repos.accountRepository.update).not.toHaveBeenCalled();
  });
});
