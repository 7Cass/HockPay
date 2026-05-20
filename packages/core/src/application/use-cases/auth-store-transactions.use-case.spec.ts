import { describe, expect, it, vi } from "vitest";
import { Merchant } from "../../domain/entities/merchant.entity";
import { RefreshToken } from "../../domain/entities/refresh-token.entity";
import { Store } from "../../domain/entities/store.entity";
import { InvalidRefreshTokenError } from "../../domain/errors/invalid-refresh-token.error";
import { Document } from "../../domain/value-objects/document.vo";
import { Email } from "../../domain/value-objects/email.vo";
import { ITransactedRepositories } from "../../domain/repositories/unit-of-work.interface";
import { CreateStoreUseCase } from "./create-store.use-case";
import { LoginUseCase } from "./login.use-case";
import { RefreshTokenUseCase } from "./refresh-token.use-case";
import { SwitchStoreUseCase } from "./switch-store.use-case";

describe("auth/store transactional use cases", () => {
  it("rolls back login token rotation when creating the new refresh token fails", async () => {
    const state = makeState();
    const merchant = makeMerchant();
    const oldToken = makeRefreshToken(merchant.id, "old-token");
    state.merchants.set(merchant.id, merchant);
    state.refreshTokens.set(oldToken.token, oldToken);
    const unitOfWork = new SnapshotUnitOfWork(state);
    unitOfWork.failRefreshCreate = true;

    const useCase = new LoginUseCase(
      unitOfWork as any,
      { verify: vi.fn().mockResolvedValue(true) } as any,
      makeJwtService() as any,
      makeTokenGenerator("new-token") as any,
    );

    await expect(
      useCase.execute({
        email: merchant.email.toString(),
        password: "secret",
      }),
    ).rejects.toThrow("refresh create failed");

    expect(state.refreshTokens.get("old-token")?.merchantId).toBe(merchant.id);
  });

  it("rolls back store creation, merchant update, and token rotation together", async () => {
    const state = makeState();
    const merchant = makeMerchant();
    const oldToken = makeRefreshToken(merchant.id, "old-token");
    state.merchants.set(merchant.id, merchant);
    state.refreshTokens.set(oldToken.token, oldToken);
    const unitOfWork = new SnapshotUnitOfWork(state);
    unitOfWork.failRefreshCreate = true;

    const useCase = new CreateStoreUseCase(
      unitOfWork as any,
      makeJwtService() as any,
      makeTokenGenerator("new-token") as any,
      {
        generateFromName: vi.fn().mockReturnValue("new-store"),
        generateUnique: vi.fn().mockResolvedValue("new-store"),
        validateFormat: vi.fn().mockReturnValue(true),
        isAvailable: vi.fn().mockResolvedValue(true),
      },
    );

    await expect(
      useCase.execute({
        merchantId: merchant.id,
        name: "New Store",
      }),
    ).rejects.toThrow("refresh create failed");

    expect(state.stores.size).toBe(0);
    expect(state.merchants.get(merchant.id)?.currentStoreId).toBeUndefined();
    expect(state.refreshTokens.get("old-token")?.merchantId).toBe(merchant.id);
  });

  it("rolls back switch store merchant update when refresh token creation fails", async () => {
    const state = makeState();
    const merchant = makeMerchant("store-old");
    const targetStore = makeStore(merchant.id, "store-new");
    const oldToken = makeRefreshToken(merchant.id, "old-token");
    state.merchants.set(merchant.id, merchant);
    state.stores.set(targetStore.id, targetStore);
    state.refreshTokens.set(oldToken.token, oldToken);
    const unitOfWork = new SnapshotUnitOfWork(state);
    unitOfWork.failRefreshCreate = true;

    const useCase = new SwitchStoreUseCase(
      unitOfWork as any,
      makeJwtService() as any,
      makeTokenGenerator("new-token") as any,
    );

    await expect(
      useCase.execute({
        merchantId: merchant.id,
        storeId: targetStore.id,
      }),
    ).rejects.toThrow("refresh create failed");

    expect(state.merchants.get(merchant.id)?.currentStoreId).toBe("store-old");
    expect(state.refreshTokens.get("old-token")?.merchantId).toBe(merchant.id);
  });

  it("treats an already rotated refresh token as invalid without creating a new token", async () => {
    const state = makeState();
    const merchant = makeMerchant();
    state.merchants.set(merchant.id, merchant);
    const unitOfWork = new SnapshotUnitOfWork(state);

    const useCase = new RefreshTokenUseCase(
      unitOfWork as any,
      makeJwtService() as any,
      makeTokenGenerator("new-token") as any,
    );

    await expect(
      useCase.execute({ refreshToken: "already-rotated" }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

    expect(state.refreshTokens.size).toBe(0);
  });
});

type State = {
  merchants: Map<string, Merchant>;
  stores: Map<string, Store>;
  refreshTokens: Map<string, RefreshToken>;
};

class SnapshotUnitOfWork {
  failRefreshCreate = false;

  constructor(private state: State) {}

  async execute<T>(work: (repos: ITransactedRepositories) => Promise<T>): Promise<T> {
    const backup = cloneState(this.state);

    try {
      return await work(this.makeRepos());
    } catch (error) {
      this.state.merchants.clear();
      this.state.stores.clear();
      this.state.refreshTokens.clear();
      for (const [id, merchant] of backup.merchants) {
        this.state.merchants.set(id, merchant);
      }
      for (const [id, store] of backup.stores) {
        this.state.stores.set(id, store);
      }
      for (const [token, refreshToken] of backup.refreshTokens) {
        this.state.refreshTokens.set(token, refreshToken);
      }
      throw error;
    }
  }

  private makeRepos(): ITransactedRepositories {
    return {
      merchantRepository: {
        save: async (merchant) => {
          this.state.merchants.set(merchant.id, cloneMerchant(merchant));
        },
        findById: async (id) =>
          cloneNullable(this.state.merchants.get(id), cloneMerchant),
        findByIdForUpdate: async (id) =>
          cloneNullable(this.state.merchants.get(id), cloneMerchant),
        findByEmail: async (email) =>
          cloneNullable(
            [...this.state.merchants.values()].find(
              (merchant) => merchant.email.toString() === email,
            ),
            cloneMerchant,
          ),
        findByDocument: async (document) =>
          cloneNullable(
            [...this.state.merchants.values()].find(
              (merchant) => merchant.document.value === document,
            ),
            cloneMerchant,
          ),
        existsByEmailOrDocument: async (email, document) =>
          [...this.state.merchants.values()].some(
            (merchant) =>
              merchant.email.toString() === email ||
              merchant.document.value === document,
          ),
        delete: async (id) => {
          this.state.merchants.delete(id);
        },
        update: async (merchant) => {
          this.state.merchants.set(merchant.id, cloneMerchant(merchant));
        },
      },
      refreshTokenRepository: {
        create: async (token) => {
          if (this.failRefreshCreate) {
            throw new Error("refresh create failed");
          }
          this.state.refreshTokens.set(token.token, cloneRefreshToken(token));
        },
        findByToken: async (token) =>
          cloneNullable(this.state.refreshTokens.get(token), cloneRefreshToken),
        findByTokenForUpdate: async (token) =>
          cloneNullable(this.state.refreshTokens.get(token), cloneRefreshToken),
        findByMerchantId: async (merchantId) =>
          cloneNullable(
            [...this.state.refreshTokens.values()].find(
              (token) => token.merchantId === merchantId,
            ),
            cloneRefreshToken,
          ),
        update: async (token) => {
          this.state.refreshTokens.set(token.token, cloneRefreshToken(token));
        },
        revokeAllForMerchant: async (merchantId) => {
          for (const [token, refreshToken] of this.state.refreshTokens) {
            if (refreshToken.merchantId === merchantId) {
              this.state.refreshTokens.delete(token);
            }
          }
        },
        deleteExpired: async () => {},
      },
      storeRepository: {
        save: async (store) => {
          this.state.stores.set(store.id, cloneStore(store));
        },
        findById: async (id) =>
          cloneNullable(this.state.stores.get(id), cloneStore),
        findByIdAndMerchantId: async (id, merchantId) =>
          cloneNullable(
            [...this.state.stores.values()].find(
              (store) => store.id === id && store.merchantId === merchantId,
            ),
            cloneStore,
          ),
        findBySlug: async (slug) =>
          cloneNullable(
            [...this.state.stores.values()].find((store) => store.slug === slug),
            cloneStore,
          ),
        findByMerchantId: async (merchantId) =>
          [...this.state.stores.values()]
            .filter((store) => store.merchantId === merchantId)
            .map(cloneStore),
        update: async (store) => {
          this.state.stores.set(store.id, cloneStore(store));
        },
        delete: async (id) => {
          this.state.stores.delete(id);
        },
      },
      paymentRepository: {} as any,
      pixChargeRepository: {} as any,
      refundRepository: {} as any,
      accountRepository: {} as any,
      transactionRepository: {} as any,
      withdrawalRepository: {} as any,
      bankAccountRepository: {} as any,
      outboxWriter: {} as any,
      receiptRepository: {} as any,
      checkoutSessionRepository: {} as any,
      customerRepository: {} as any,
      idempotencyKeyRepository: {} as any,
    };
  }
}

function makeState(): State {
  return {
    merchants: new Map(),
    stores: new Map(),
    refreshTokens: new Map(),
  };
}

function cloneState(state: State): State {
  return {
    merchants: new Map(
      [...state.merchants.entries()].map(([id, merchant]) => [
        id,
        cloneMerchant(merchant),
      ]),
    ),
    stores: new Map(
      [...state.stores.entries()].map(([id, store]) => [id, cloneStore(store)]),
    ),
    refreshTokens: new Map(
      [...state.refreshTokens.entries()].map(([token, refreshToken]) => [
        token,
        cloneRefreshToken(refreshToken),
      ]),
    ),
  };
}

function cloneNullable<T>(value: T | undefined, clone: (value: T) => T): T | null {
  return value ? clone(value) : null;
}

function makeMerchant(currentStoreId?: string): Merchant {
  return Merchant.reconstitute({
    id: "merchant-1",
    email: new Email("merchant@example.com"),
    document: new Document("52998224725"),
    passwordHash: "hashed-secret",
    name: "Merchant",
    isActive: true,
    currentStoreId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
}

function makeStore(merchantId: string, id: string): Store {
  return Store.reconstitute({
    id,
    merchantId,
    name: id,
    slug: id,
    isActive: true,
    isApproved: true,
    settlementDays: 30,
    feePercent: 1.5,
    feeFixed: 15,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
}

function makeRefreshToken(merchantId: string, token: string): RefreshToken {
  return RefreshToken.reconstitute({
    id: `refresh-${token}`,
    token,
    merchantId,
    expiresAt: new Date("2026-12-31T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
}

function cloneMerchant(merchant: Merchant): Merchant {
  return Merchant.reconstitute({
    id: merchant.id,
    email: merchant.email,
    document: merchant.document,
    passwordHash: merchant.passwordHash,
    name: merchant.name,
    isActive: merchant.isActive,
    currentStoreId: merchant.currentStoreId,
    createdAt: merchant.createdAt,
    updatedAt: merchant.updatedAt,
  });
}

function cloneStore(store: Store): Store {
  return Store.reconstitute(store.toObject());
}

function cloneRefreshToken(token: RefreshToken): RefreshToken {
  return RefreshToken.reconstitute({
    id: token.id,
    token: token.token,
    merchantId: token.merchantId,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
  });
}

function makeJwtService() {
  return {
    generateAccessToken: vi.fn((_merchantId: string, storeId: string | null) =>
      Promise.resolve(`access:${storeId ?? "none"}`),
    ),
  };
}

function makeTokenGenerator(refreshToken: string) {
  return {
    generateBase64: vi.fn().mockReturnValue(refreshToken),
  };
}
