import { describe, expect, it, vi } from 'vitest';
import { ReleasePaymentUseCase } from './release-payment.use-case';
import { Payment } from '../../domain/entities/payment.entity';
import { Account } from '../../domain/entities/account.entity';
import { Refund } from '../../domain/entities/refund.entity';
import { TransactionType } from '../../domain/entities/transaction.entity';

describe('ReleasePaymentUseCase', () => {
  it('releases only the remaining net amount after processed refunds', async () => {
    const payment = Payment.create({
      storeId: 'store-1',
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
      id: 'account-1',
      storeId: 'store-1',
      available: 0,
      pending: 6_750,
      blocked: 0,
      currency: 'BRL',
      updatedAt: new Date(),
    });

    const repos = {
      paymentRepository: {
        findById: vi.fn().mockResolvedValue(payment),
        update: vi.fn(),
      },
      refundRepository: {
        findByPaymentId: vi.fn().mockResolvedValue([refund]),
      },
      accountRepository: {
        findByStoreId: vi.fn().mockResolvedValue(account),
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
  });
});
