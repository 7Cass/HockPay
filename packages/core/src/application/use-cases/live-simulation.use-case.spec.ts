import { describe, expect, it, vi } from 'vitest';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case';
import { ReleasePaymentUseCase } from './release-payment.use-case';
import { Account } from '../../domain/entities/account.entity';
import { Payment } from '../../domain/entities/payment.entity';
import { Store } from '../../domain/entities/store.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { StoreLiveStatus } from '../../domain/value-objects/store-live-status.vo';
import { StoreLiveNotEnabledError } from '../../domain/errors/store-live-not-enabled.error';
import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';

/**
 * O que a fatia 3 entrega de observavel: a loja aprovada cobra em LIVE, e o
 * ledger LIVE -- que a fatia 2 criou vazio -- enche.
 *
 * Todo teste aqui le **as duas contas** depois da operacao. Assertar so a
 * esperada deixaria passar exatamente o bug que a separacao existe para
 * impedir: creditar as duas, ou creditar a errada.
 */
function storeAt(liveStatus: StoreLiveStatus): Store {
  return Store.reconstitute({
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Ateliê Corvo',
    slug: 'atelie-corvo',
    isActive: true,
    liveStatus,
    settlementDays: 2,
    feePercent: 1.5,
    feeFixed: 15,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function makeHarness(payment: Payment, store: Store) {
  const accounts = new Map<Environment, Account>([
    [Environment.TEST, Account.create({ storeId: 'store-1', environment: Environment.TEST })],
    [Environment.LIVE, Account.create({ storeId: 'store-1', environment: Environment.LIVE })],
  ]);

  const accountRepository = {
    findByStoreIdAndEnvironment: vi.fn(
      async (_s: string, env: Environment) => accounts.get(env) ?? null,
    ),
    findByStoreIdAndEnvironmentForUpdate: vi.fn(
      async (_s: string, env: Environment) => accounts.get(env) ?? null,
    ),
    update: vi.fn(),
  };

  const repos = {
    paymentRepository: {
      findByIdAndStoreIdForUpdate: vi.fn(async () => payment),
      findByIdForUpdate: vi.fn(async () => payment),
      update: vi.fn(),
    },
    refundRepository: { findByPaymentId: vi.fn(async () => []) },
    accountRepository,
    transactionRepository: { save: vi.fn() },
    bankAccountRepository: {},
    outboxWriter: { save: vi.fn() },
    receiptRepository: {
      incrementCounter: vi.fn(async () => 1),
      save: vi.fn(),
    },
    storeRepository: { findById: vi.fn(async () => store) },
    customerRepository: {},
  };

  return { accounts, repos, unitOfWork: { execute: async (work: any) => work(repos) } as any };
}

function livePayment(): Payment {
  return Payment.create({
    storeId: 'store-1',
    amount: 7990,
    fee: 135,
    netAmount: 7855,
    expiresAt: new Date(Date.now() + 60_000),
    environment: Environment.LIVE,
  });
}

describe('simulacao em LIVE', () => {
  it('credita o ledger LIVE quando a mesa aprovou, e nao encosta no TEST', async () => {
    const payment = livePayment();
    const { accounts, repos, unitOfWork } = makeHarness(payment, storeAt(StoreLiveStatus.APPROVED));

    await new ConfirmPaymentUseCase(unitOfWork).execute({
      storeId: 'store-1',
      paymentId: payment.id,
      callerEnvironment: Environment.LIVE,
    });

    expect(repos.accountRepository.findByStoreIdAndEnvironmentForUpdate).toHaveBeenCalledWith(
      'store-1',
      Environment.LIVE,
    );
    expect(accounts.get(Environment.LIVE)?.pending).toBe(7855);
    expect(accounts.get(Environment.TEST)?.pending).toBe(0);
    expect(accounts.get(Environment.TEST)?.available).toBe(0);
  });

  it.each([
    StoreLiveStatus.NOT_REQUESTED,
    StoreLiveStatus.PENDING,
    StoreLiveStatus.REJECTED,
    StoreLiveStatus.SUSPENDED,
  ])('recusa LIVE com liveStatus %s, e nao move saldo nenhum', async (status) => {
    const payment = livePayment();
    const { accounts, repos, unitOfWork } = makeHarness(payment, storeAt(status));

    await expect(
      new ConfirmPaymentUseCase(unitOfWork).execute({
        storeId: 'store-1',
        paymentId: payment.id,
        callerEnvironment: Environment.LIVE,
      }),
    ).rejects.toBeInstanceOf(StoreLiveNotEnabledError);

    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(accounts.get(Environment.LIVE)?.pending).toBe(0);
    expect(accounts.get(Environment.TEST)?.pending).toBe(0);
  });

  it('para um pagamento LIVE que ja estava PENDING quando a mesa suspende', async () => {
    // A regra e uma so: LIVE do chamador exige APPROVED. O pagamento em voo
    // nao confirma mais, e segue ate expirar.
    const payment = livePayment();
    const { unitOfWork } = makeHarness(payment, storeAt(StoreLiveStatus.SUSPENDED));

    await expect(
      new ConfirmPaymentUseCase(unitOfWork).execute({
        storeId: 'store-1',
        paymentId: payment.id,
        callerEnvironment: Environment.LIVE,
      }),
    ).rejects.toBeInstanceOf(StoreLiveNotEnabledError);
  });

  it('nao deixa uma key TEST confirmar pagamento LIVE de loja aprovada', async () => {
    // A habilitacao abriu LIVE; ela nao dissolveu o isolamento entre os dois.
    const payment = livePayment();
    const { accounts, unitOfWork } = makeHarness(payment, storeAt(StoreLiveStatus.APPROVED));

    await expect(
      new ConfirmPaymentUseCase(unitOfWork).execute({
        storeId: 'store-1',
        paymentId: payment.id,
        callerEnvironment: Environment.TEST,
      }),
    ).rejects.toBeInstanceOf(LiveEnvironmentNotAllowedError);

    expect(accounts.get(Environment.LIVE)?.pending).toBe(0);
  });

  it('deixa o settlement liquidar LIVE de loja suspensa', async () => {
    // A excecao do PRD: bloquear o relogio prenderia dinheiro LIVE em pending
    // para sempre, que e pior do que qualquer coisa que a suspensao evita.
    const payment = livePayment();
    payment.confirm();
    const { accounts, unitOfWork } = makeHarness(payment, storeAt(StoreLiveStatus.SUSPENDED));
    accounts.get(Environment.LIVE)!.addToPending(7855);

    await new ReleasePaymentUseCase(unitOfWork).execute({
      paymentId: payment.id,
      systemInitiated: true,
    });

    expect(payment.isReleased()).toBe(true);
    expect(accounts.get(Environment.LIVE)?.available).toBe(7855);
    expect(accounts.get(Environment.TEST)?.available).toBe(0);
  });
});
