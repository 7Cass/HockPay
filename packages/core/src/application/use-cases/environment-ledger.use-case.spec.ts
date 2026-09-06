import { describe, expect, it, vi } from 'vitest';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case';
import { CreateWithdrawalUseCase } from './create-withdrawal.use-case';
import { Account } from '../../domain/entities/account.entity';
import { Payment } from '../../domain/entities/payment.entity';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * O ledger e por ambiente, e estes testes leem as duas contas depois de cada
 * operacao. Assertar so a conta esperada deixaria passar exatamente o bug que a
 * separacao existe para impedir: creditar as duas, ou creditar a errada.
 */
function makeLedger() {
  const accounts = new Map<string, Account>([
    [Environment.TEST, Account.create({ storeId: 'store-1', environment: Environment.TEST })],
    [Environment.LIVE, Account.create({ storeId: 'store-1', environment: Environment.LIVE })],
  ]);

  const accountRepository = {
    findByStoreIdAndEnvironment: vi.fn(
      async (_storeId: string, environment: Environment) => accounts.get(environment) ?? null,
    ),
    findByStoreIdAndEnvironmentForUpdate: vi.fn(
      async (_storeId: string, environment: Environment) => accounts.get(environment) ?? null,
    ),
    findById: vi.fn(
      async (id: string) => [...accounts.values()].find((account) => account.id === id) ?? null,
    ),
    update: vi.fn(),
  };

  return { accounts, accountRepository };
}

function makeStore() {
  return {
    id: 'store-1',
    name: 'Hockpay Store',
    isActive: true,
    isApproved: true,
    settlementDays: 2,
  };
}

describe('ledger por ambiente', () => {
  it('credita a conta do ambiente do pagamento e nao encosta na outra', async () => {
    const { accounts, accountRepository } = makeLedger();

    const payment = Payment.create({
      storeId: 'store-1',
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.TEST,
    });

    const unitOfWork = {
      execute: async (work: any) =>
        work({
          paymentRepository: {
            findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(payment),
            update: vi.fn(),
          },
          accountRepository,
          transactionRepository: { save: vi.fn() },
          bankAccountRepository: {},
          outboxWriter: { save: vi.fn() },
          receiptRepository: {
            incrementCounter: vi.fn().mockResolvedValue(1),
            save: vi.fn(),
          },
          storeRepository: { findById: vi.fn().mockResolvedValue(makeStore()) },
          customerRepository: {},
        }),
    };

    await new ConfirmPaymentUseCase(unitOfWork as never).execute({
      storeId: 'store-1',
      paymentId: payment.id,
    });

    expect(accountRepository.findByStoreIdAndEnvironmentForUpdate).toHaveBeenCalledWith(
      'store-1',
      Environment.TEST,
    );
    expect(accounts.get(Environment.TEST)?.pending).toBe(7855);
    expect(accounts.get(Environment.LIVE)?.pending).toBe(0);
    expect(accounts.get(Environment.LIVE)?.available).toBe(0);
  });

  it('reserva saldo do ambiente da request no saque, e so dele', async () => {
    const { accounts, accountRepository } = makeLedger();
    accounts.get(Environment.TEST)!.addToPending(10_000);
    accounts.get(Environment.TEST)!.releaseFromPending(10_000);
    accounts.get(Environment.LIVE)!.addToPending(50_000);
    accounts.get(Environment.LIVE)!.releaseFromPending(50_000);

    const bankAccount = {
      id: 'bank-1',
      storeId: 'store-1',
      isVerified: true,
      isDefault: true,
      belongsToStore: () => true,
      canReceiveWithdrawal: () => true,
    };

    const unitOfWork = {
      execute: async (work: any) =>
        work({
          accountRepository,
          bankAccountRepository: {
            findById: vi.fn().mockResolvedValue(bankAccount),
            findByIdAndStoreId: vi.fn().mockResolvedValue(bankAccount),
          },
          storeRepository: { findById: vi.fn().mockResolvedValue(makeStore()) },
          withdrawalRepository: {
            save: vi.fn(),
            sumAmountCreatedInRange: vi.fn().mockResolvedValue(0),
            countCreatedInRange: vi.fn().mockResolvedValue(0),
          },
          transactionRepository: { save: vi.fn() },
          outboxWriter: { save: vi.fn() },
        }),
    };

    await new CreateWithdrawalUseCase(unitOfWork as never).execute({
      storeId: 'store-1',
      bankAccountId: 'bank-1',
      amount: 5_000,
      environment: Environment.TEST,
    });

    expect(accounts.get(Environment.TEST)?.available).toBe(5_000);
    expect(accounts.get(Environment.TEST)?.blocked).toBe(5_000);
    // O saldo LIVE nao participa da reserva, nem para cobrir o saque.
    expect(accounts.get(Environment.LIVE)?.available).toBe(50_000);
    expect(accounts.get(Environment.LIVE)?.blocked).toBe(0);
  });

  it('nao usa o saldo do outro ambiente para cobrir um saque', async () => {
    const { accounts, accountRepository } = makeLedger();
    accounts.get(Environment.LIVE)!.addToPending(50_000);
    accounts.get(Environment.LIVE)!.releaseFromPending(50_000);

    const bankAccount = {
      id: 'bank-1',
      storeId: 'store-1',
      isVerified: true,
      isDefault: true,
      belongsToStore: () => true,
      canReceiveWithdrawal: () => true,
    };

    const unitOfWork = {
      execute: async (work: any) =>
        work({
          accountRepository,
          bankAccountRepository: {
            findById: vi.fn().mockResolvedValue(bankAccount),
            findByIdAndStoreId: vi.fn().mockResolvedValue(bankAccount),
          },
          storeRepository: { findById: vi.fn().mockResolvedValue(makeStore()) },
          withdrawalRepository: {
            save: vi.fn(),
            sumAmountCreatedInRange: vi.fn().mockResolvedValue(0),
            countCreatedInRange: vi.fn().mockResolvedValue(0),
          },
          transactionRepository: { save: vi.fn() },
          outboxWriter: { save: vi.fn() },
        }),
    };

    await expect(
      new CreateWithdrawalUseCase(unitOfWork as never).execute({
        storeId: 'store-1',
        bankAccountId: 'bank-1',
        amount: 5_000,
        environment: Environment.TEST,
      }),
    ).rejects.toThrowError();

    expect(accounts.get(Environment.LIVE)?.available).toBe(50_000);
    expect(accounts.get(Environment.LIVE)?.blocked).toBe(0);
  });
});
