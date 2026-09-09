import { describe, expect, it, vi } from 'vitest';
import { CreateWithdrawalUseCase } from './create-withdrawal.use-case';
import { CreateRefundUseCase } from './create-refund.use-case';
import { Account } from '../../domain/entities/account.entity';
import { BankAccount, PixKeyType } from '../../domain/entities/bank-account.entity';
import { Payment } from '../../domain/entities/payment.entity';
import { Store } from '../../domain/entities/store.entity';
import { StoreLiveStatus } from '../../domain/value-objects/store-live-status.vo';
import { StoreLiveNotEnabledError } from '../../domain/errors/store-live-not-enabled.error';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * A habilitacao LIVE fecha a saida de dinheiro, e nao so a entrada.
 *
 * O gate de cobranca ja tinha a sua suite (`live-enablement-gate`); esta e a
 * outra metade, que faltava. A forma e a mesma de proposito: cada caminho roda
 * nos cinco estados em TEST, que precisam passar todos, e nos cinco em LIVE,
 * onde so `APPROVED` passa. Testar so a recusa deixaria passar o bug caro -- um
 * gate que tambem fecha TEST quebra a promessa de operar no minuto zero.
 *
 * O ultimo bloco de cada caminho e o que a mesa faz: `operatorInitiated` passa
 * mesmo com a loja fechada, porque o saldo LIVE continua sendo do lojista e a
 * mesa e a saida dele.
 */
function storeAt(liveStatus: StoreLiveStatus): Store {
  return Store.reconstitute({
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Ateliê Corvo',
    slug: 'atelie-corvo',
    isActive: true,
    liveStatus,
    settlementDays: 1,
    feePercent: 1.5,
    feeFixed: 15,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

const ALL_STATUSES = Object.values(StoreLiveStatus);
const BLOCKED = ALL_STATUSES.filter((status) => status !== StoreLiveStatus.APPROVED);

describe('gate de habilitacao LIVE na saida de dinheiro', () => {
  describe('create-withdrawal', () => {
    function makeRepos(store: Store) {
      const account = Account.reconstitute({
        id: 'account-1',
        storeId: store.id,
        available: 100_000,
        pending: 0,
        blocked: 0,
        currency: 'BRL',
        updatedAt: new Date(),
      });
      const bankAccount = BankAccount.reconstitute({
        id: 'bank-1',
        storeId: store.id,
        pixKey: '12345678901',
        pixKeyType: PixKeyType.CPF,
        holderName: 'Merchant',
        holderDocument: '12345678901',
        isDefault: true,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        storeRepository: { findById: vi.fn(async () => store) },
        accountRepository: {
          findByStoreIdAndEnvironmentForUpdate: vi.fn(async () => account),
          update: vi.fn(),
        },
        bankAccountRepository: { findById: vi.fn(async () => bankAccount) },
        withdrawalRepository: {
          save: vi.fn(),
          sumAmountCreatedInRange: vi.fn(async () => 0),
          countCreatedInRange: vi.fn(async () => 0),
        },
        transactionRepository: { save: vi.fn() },
        outboxWriter: { save: vi.fn() },
      };
    }

    function run(store: Store, environment: Environment, operatorInitiated = false) {
      const repos = makeRepos(store);
      const useCase = new CreateWithdrawalUseCase({
        execute: async (work: any) => work(repos),
      } as any);

      return useCase.execute({
        storeId: 'store-1',
        bankAccountId: 'bank-1',
        amount: 10_000,
        environment,
        operatorInitiated,
      });
    }

    it.each(ALL_STATUSES)('saca em TEST com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.TEST)).resolves.toBeDefined();
    });

    it.each(BLOCKED)('recusa saque LIVE com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.LIVE)).rejects.toBeInstanceOf(
        StoreLiveNotEnabledError,
      );
    });

    it('saca em LIVE quando a mesa aprovou', async () => {
      await expect(run(storeAt(StoreLiveStatus.APPROVED), Environment.LIVE)).resolves.toBeDefined();
    });

    it.each(BLOCKED)('deixa a mesa sacar em LIVE com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.LIVE, true)).resolves.toBeDefined();
    });
  });

  describe('create-refund', () => {
    function makeRepos(store: Store, environment: Environment) {
      const payment = Payment.create({
        storeId: store.id,
        amount: 10_000,
        fee: 1_000,
        netAmount: 9_000,
        environment,
        expiresAt: new Date(Date.now() + 60_000),
      });
      payment.confirm();

      const account = Account.reconstitute({
        id: 'account-1',
        storeId: store.id,
        available: 0,
        pending: 9_000,
        blocked: 0,
        currency: 'BRL',
        updatedAt: new Date(),
      });

      return {
        payment,
        repos: {
          storeRepository: { findById: vi.fn(async () => store) },
          paymentRepository: {
            findByIdAndStoreIdForUpdate: vi.fn(async () => payment),
            update: vi.fn(),
          },
          refundRepository: { save: vi.fn() },
          accountRepository: {
            findByStoreIdAndEnvironmentForUpdate: vi.fn(async () => account),
            update: vi.fn(),
          },
          transactionRepository: { save: vi.fn() },
          outboxWriter: { save: vi.fn() },
        },
      };
    }

    function run(store: Store, environment: Environment, operatorInitiated = false) {
      const { payment, repos } = makeRepos(store, environment);
      const useCase = new CreateRefundUseCase({
        execute: async (work: any) => work(repos),
      } as any);

      return useCase.execute({
        storeId: 'store-1',
        paymentId: payment.id,
        amount: 2_500,
        reason: 'pedido do comprador',
        // Quem decide o estorno e o ambiente do pagamento; o do chamador so
        // precisa alcanca-lo, e e por isso que os dois andam juntos aqui.
        callerEnvironment: environment,
        operatorInitiated,
      });
    }

    it.each(ALL_STATUSES)('estorna em TEST com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.TEST)).resolves.toBeDefined();
    });

    it.each(BLOCKED)('recusa estorno LIVE com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.LIVE)).rejects.toBeInstanceOf(
        StoreLiveNotEnabledError,
      );
    });

    it('estorna em LIVE quando a mesa aprovou', async () => {
      await expect(run(storeAt(StoreLiveStatus.APPROVED), Environment.LIVE)).resolves.toBeDefined();
    });

    it.each(BLOCKED)('deixa a mesa estornar em LIVE com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.LIVE, true)).resolves.toBeDefined();
    });
  });
});
