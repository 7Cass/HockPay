import { describe, expect, it, vi } from 'vitest';
import { Merchant } from '../../domain/entities/merchant.entity';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { Store } from '../../domain/entities/store.entity';
import { Document } from '../../domain/value-objects/document.vo';
import { Email } from '../../domain/value-objects/email.vo';
import { Environment } from '../../domain/value-objects/environment.vo';
import { StoreLiveStatus } from '../../domain/value-objects/store-live-status.vo';
import { ITransactedRepositories } from '../../domain/repositories/unit-of-work.interface';
import { LoginUseCase } from './login.use-case';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import { SwitchStoreUseCase } from './switch-store.use-case';

/**
 * The environment of a merchant session: where it lives, who copies it into a
 * token, and who is allowed to change it.
 *
 * The invariant these tests defend is the one from the PRD: the merchant is the
 * source and the token is the copy. Every path that mints a token has to read
 * the merchant, because the one that forgets drops the session back to TEST
 * mid-session without anybody having asked.
 */
describe('session environment', () => {
  it('mints the login token in the environment persisted on the merchant', async () => {
    const world = makeWorld();
    const store = world.addStore('store-1', StoreLiveStatus.APPROVED);
    const merchant = world.addMerchant(store.id, Environment.LIVE);

    const useCase = new LoginUseCase(
      world.unitOfWork as never,
      { verify: vi.fn().mockResolvedValue(true) } as never,
      world.jwtService as never,
      world.tokenGenerator as never,
    );

    await useCase.execute({
      email: merchant.email.toString(),
      password: 'secret',
    });

    expect(world.lastIssuedEnvironment()).toBe(Environment.LIVE);
  });

  it('mints the refreshed token in the environment persisted on the merchant', async () => {
    const world = makeWorld();
    const store = world.addStore('store-1', StoreLiveStatus.APPROVED);
    const merchant = world.addMerchant(store.id, Environment.LIVE);
    world.addRefreshToken(merchant.id, 'live-refresh');

    const useCase = new RefreshTokenUseCase(
      world.unitOfWork as never,
      world.jwtService as never,
      world.tokenGenerator as never,
    );

    await useCase.execute({ refreshToken: 'live-refresh' });

    expect(world.lastIssuedEnvironment()).toBe(Environment.LIVE);
  });

  it('keeps a TEST session in TEST when the store is approved for LIVE', async () => {
    const world = makeWorld();
    const store = world.addStore('store-1', StoreLiveStatus.APPROVED);
    const merchant = world.addMerchant(store.id, Environment.TEST);
    world.addRefreshToken(merchant.id, 'test-refresh');

    const useCase = new RefreshTokenUseCase(
      world.unitOfWork as never,
      world.jwtService as never,
      world.tokenGenerator as never,
    );

    await useCase.execute({ refreshToken: 'test-refresh' });

    // Enablement is permission, not preference: an approved store does not
    // move a merchant who never asked for LIVE.
    expect(world.lastIssuedEnvironment()).toBe(Environment.TEST);
  });

  it('mints the switch-store token from the merchant, not from a hardcoded TEST', async () => {
    const world = makeWorld();
    const origin = world.addStore('store-1', StoreLiveStatus.APPROVED);
    const target = world.addStore('store-2', StoreLiveStatus.APPROVED);
    const merchant = world.addMerchant(origin.id, Environment.LIVE);

    const useCase = new SwitchStoreUseCase(
      world.unitOfWork as never,
      world.jwtService as never,
      world.tokenGenerator as never,
    );

    await useCase.execute({ merchantId: merchant.id, storeId: target.id });

    expect(world.jwtService.generateAccessToken).toHaveBeenCalledWith(
      merchant.id,
      target.id,
      expect.any(String),
      '15m',
    );
  });
});

/**
 * A minimal in-memory world: only the four repositories these use cases touch,
 * with no rollback semantics (the transactional behaviour has its own spec).
 */
function makeWorld() {
  const merchants = new Map<string, Merchant>();
  const stores = new Map<string, Store>();
  const refreshTokens = new Map<string, RefreshToken>();

  const jwtService = {
    generateAccessToken: vi.fn((_sub: string, storeId: string | null, environment: Environment) =>
      Promise.resolve(`access:${storeId ?? 'none'}:${environment}`),
    ),
  };

  const repos = {
    merchantRepository: {
      findById: async (id: string) => merchants.get(id) ?? null,
      findByIdForUpdate: async (id: string) => merchants.get(id) ?? null,
      findByEmail: async (email: string) =>
        [...merchants.values()].find((merchant) => merchant.email.toString() === email) ?? null,
      update: async (merchant: Merchant) => {
        merchants.set(merchant.id, merchant);
      },
    },
    storeRepository: {
      findById: async (id: string) => stores.get(id) ?? null,
      findByIdAndMerchantId: async (id: string, merchantId: string) => {
        const store = stores.get(id);
        return store && store.merchantId === merchantId ? store : null;
      },
    },
    refreshTokenRepository: {
      create: async (token: RefreshToken) => {
        refreshTokens.set(token.token, token);
      },
      findByTokenForUpdate: async (token: string) => refreshTokens.get(token) ?? null,
      update: async (token: RefreshToken) => {
        refreshTokens.set(token.token, token);
      },
      revokeAllForMerchant: async (merchantId: string) => {
        for (const [key, token] of refreshTokens) {
          if (token.merchantId === merchantId) refreshTokens.delete(key);
        }
      },
    },
  } as unknown as ITransactedRepositories;

  return {
    jwtService,
    tokenGenerator: { generateBase64: vi.fn().mockReturnValue('next-refresh') },
    unitOfWork: {
      execute: <T>(work: (r: ITransactedRepositories) => Promise<T>) => work(repos),
    },
    merchants,
    stores,
    refreshTokens,

    addStore(id: string, liveStatus: StoreLiveStatus): Store {
      const store = Store.reconstitute({
        id,
        merchantId: 'merchant-1',
        name: id,
        slug: id,
        isActive: true,
        liveStatus,
        settlementDays: 30,
        feePercent: 1.5,
        feeFixed: 15,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      stores.set(store.id, store);
      return store;
    },

    addMerchant(currentStoreId: string, currentEnvironment: Environment): Merchant {
      const merchant = Merchant.reconstitute({
        id: 'merchant-1',
        email: new Email('merchant@example.com'),
        document: new Document('52998224725'),
        passwordHash: 'hashed-secret',
        name: 'Merchant',
        isActive: true,
        currentStoreId,
        currentEnvironment,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      merchants.set(merchant.id, merchant);
      return merchant;
    },

    addRefreshToken(merchantId: string, token: string): RefreshToken {
      const refreshToken = RefreshToken.reconstitute({
        id: `refresh-${token}`,
        token,
        merchantId,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      refreshTokens.set(token, refreshToken);
      return refreshToken;
    },

    lastIssuedEnvironment(): Environment {
      const calls = jwtService.generateAccessToken.mock.calls;
      return calls[calls.length - 1][2];
    },
  };
}
