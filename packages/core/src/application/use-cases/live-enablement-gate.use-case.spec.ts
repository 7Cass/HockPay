import { describe, expect, it, vi } from 'vitest';
import { CreatePaymentUseCase } from './create-payment.use-case';
import { CreatePaymentLinkUseCase } from './create-payment-link.use-case';
import { CreateCheckoutSessionUseCase } from './create-checkout-session.use-case';
import { Store } from '../../domain/entities/store.entity';
import { StoreLiveStatus } from '../../domain/value-objects/store-live-status.vo';
import { StoreLiveNotEnabledError } from '../../domain/errors/store-live-not-enabled.error';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * A habilitacao LIVE e um gate de LIVE, e de nada mais.
 *
 * Cada teste aqui roda o mesmo caminho duas vezes: uma em TEST, que precisa
 * passar em todos os cinco estados, e uma em LIVE, que so passa em APPROVED.
 * Testar so a recusa deixaria passar o bug caro -- um gate que tambem fecha
 * TEST e quebra a promessa de cobrar no minuto zero.
 */
function storeAt(liveStatus: StoreLiveStatus): Store {
  return Store.reconstitute({
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Ateliê Corvo',
    slug: 'atelie-corvo',
    isActive: true,
    liveStatus,
    settlementDays: 30,
    feePercent: 1.5,
    feeFixed: 15,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

const ALL_STATUSES = Object.values(StoreLiveStatus);
const BLOCKED = ALL_STATUSES.filter((status) => status !== StoreLiveStatus.APPROVED);

function makeRepos(store: Store) {
  return {
    storeRepository: { findById: vi.fn(async () => store) },
    paymentRepository: {
      externalIdExists: vi.fn(async () => false),
      save: vi.fn(),
      saveItems: vi.fn(),
    },
    customerRepository: {
      findByExternalId: vi.fn(async () => null),
      findByDocument: vi.fn(async () => null),
      save: vi.fn(),
      update: vi.fn(),
    },
    pixChargeRepository: { save: vi.fn() },
    paymentLinkRepository: { save: vi.fn() },
    checkoutSessionRepository: { save: vi.fn() },
    productRepository: {},
    outboxWriter: { save: vi.fn() },
  };
}

const tokenGenerator = { generateBase64: () => 'token' } as any;
const pixQrCodeGenerator = {
  generate: async () => ({ qrCodeBase64: 'qr', copyPaste: 'pix', txId: 'txid' }),
} as any;

describe('gate de habilitacao LIVE na criacao de cobranca', () => {
  describe('create-payment', () => {
    function run(store: Store, environment: Environment) {
      const repos = makeRepos(store);
      const useCase = new CreatePaymentUseCase(
        { execute: async (work: any) => work(repos) } as any,
        pixQrCodeGenerator,
        { scheduleExpiration: vi.fn() } as any,
        { calculate: () => ({ feeInCents: 135, netAmountInCents: 7855 }) } as any,
        'pix-key',
      );

      return useCase.execute({
        storeId: 'store-1',
        amount: 7990,
        environment,
        customer: { name: 'Comprador', email: 'comprador@example.com' },
      } as any);
    }

    it.each(ALL_STATUSES)('cobra em TEST com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.TEST)).resolves.toBeDefined();
    });

    it.each(BLOCKED)('recusa LIVE com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.LIVE)).rejects.toBeInstanceOf(
        StoreLiveNotEnabledError,
      );
    });

    it('cobra em LIVE quando a mesa aprovou', async () => {
      await expect(run(storeAt(StoreLiveStatus.APPROVED), Environment.LIVE)).resolves.toBeDefined();
    });
  });

  describe('create-payment-link', () => {
    function run(store: Store, environment: Environment) {
      const repos = makeRepos(store);
      const useCase = new CreatePaymentLinkUseCase(
        repos.paymentLinkRepository as any,
        repos.pixChargeRepository as any,
        repos.storeRepository as any,
        tokenGenerator,
        pixQrCodeGenerator,
        'http://localhost:3333',
        'pix-key',
        { execute: async (work: any) => work(repos) } as any,
      );

      return useCase.execute({
        storeId: 'store-1',
        amount: 7990,
        environment,
        title: 'Camiseta',
      } as any);
    }

    it.each(ALL_STATUSES)('cria link em TEST com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.TEST)).resolves.toBeDefined();
    });

    it.each(BLOCKED)('recusa link LIVE com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.LIVE)).rejects.toBeInstanceOf(
        StoreLiveNotEnabledError,
      );
    });

    it('cria link LIVE quando a mesa aprovou', async () => {
      await expect(run(storeAt(StoreLiveStatus.APPROVED), Environment.LIVE)).resolves.toBeDefined();
    });
  });

  describe('create-checkout-session', () => {
    function run(store: Store, environment: Environment) {
      const repos = makeRepos(store);
      const useCase = new CreateCheckoutSessionUseCase(
        { execute: async (work: any) => work(repos) } as any,
        tokenGenerator,
        'http://localhost:3333',
      );

      return useCase.execute({
        storeId: 'store-1',
        amount: 7990,
        environment,
      } as any);
    }

    it.each(ALL_STATUSES)('cria sessao em TEST com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.TEST)).resolves.toBeDefined();
    });

    it.each(BLOCKED)('recusa sessao LIVE com liveStatus %s', async (status) => {
      await expect(run(storeAt(status), Environment.LIVE)).rejects.toBeInstanceOf(
        StoreLiveNotEnabledError,
      );
    });

    it('cria sessao LIVE quando a mesa aprovou', async () => {
      await expect(run(storeAt(StoreLiveStatus.APPROVED), Environment.LIVE)).resolves.toBeDefined();
    });
  });
});
