import { describe, expect, it } from "vitest";
import { Account } from "../../domain/entities/account.entity";
import { ApiKey } from "../../domain/entities/api-key.entity";
import { CheckoutSession } from "../../domain/entities/checkout-session.entity";
import { Customer } from "../../domain/entities/customer.entity";
import { Merchant } from "../../domain/entities/merchant.entity";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import { Payment } from "../../domain/entities/payment.entity";
import { PixCharge } from "../../domain/entities/pix-charge.entity";
import { Receipt } from "../../domain/entities/receipt.entity";
import { RefreshToken } from "../../domain/entities/refresh-token.entity";
import { Store } from "../../domain/entities/store.entity";
import { Document } from "../../domain/value-objects/document.vo";
import { Email } from "../../domain/value-objects/email.vo";
import { Environment } from "../../domain/value-objects/environment.vo";
import { FeePolicy } from "../services/fee-policy.service";
import { ConfirmPaymentUseCase } from "./confirm-payment.use-case";
import { CreateApiKeyUseCase } from "./create-api-key.use-case";
import { CreateCheckoutSessionUseCase } from "./create-checkout-session.use-case";
import { CreatePaymentUseCase } from "./create-payment.use-case";
import { CreateStoreUseCase } from "./create-store.use-case";
import { FulfillCheckoutSessionUseCase } from "./fulfill-checkout-session.use-case";
import { GetCheckoutSessionUseCase } from "./get-checkout-session.use-case";

describe("P0 checkout happy path", () => {
  it("creates a store account, fulfills checkout, confirms payment, and writes receipt/outbox", async () => {
    const merchants = new InMemoryMerchantRepository();
    const stores = new InMemoryStoreRepository();
    const accounts = new InMemoryAccountRepository();
    const apiKeys = new InMemoryApiKeyRepository();
    const sessions = new InMemoryCheckoutSessionRepository();
    const payments = new InMemoryPaymentRepository();
    const pixCharges = new InMemoryPixChargeRepository();
    const customers = new InMemoryCustomerRepository();
    const receipts = new InMemoryReceiptRepository();
    const outbox = new InMemoryOutboxWriter();
    const transactions = new InMemoryTransactionRepository();
    const tokenGenerator = new DeterministicTokenGenerator();
    const refreshTokens = new InMemoryRefreshTokenRepository();
    const storeRepositoryWithAccount = {
      async save(store: Store) {
        await stores.save(store);
        await accounts.save(Account.create({ storeId: store.id }));
      },
      findById: stores.findById.bind(stores),
      findByIdAndMerchantId: stores.findByIdAndMerchantId.bind(stores),
      findBySlug: stores.findBySlug.bind(stores),
      findByMerchantId: stores.findByMerchantId.bind(stores),
      update: stores.update.bind(stores),
      delete: stores.delete.bind(stores),
    };
    const makeRepos = () => ({
      paymentRepository: payments,
      pixChargeRepository: pixCharges,
      refundRepository: {} as any,
      accountRepository: accounts,
      transactionRepository: transactions,
      withdrawalRepository: {} as any,
      bankAccountRepository: {} as any,
      outboxWriter: outbox,
      receiptRepository: receipts,
      storeRepository: storeRepositoryWithAccount,
      merchantRepository: merchants,
      refreshTokenRepository: refreshTokens,
      checkoutSessionRepository: sessions,
      paymentLinkRepository: {} as any,
      customerRepository: customers,
      idempotencyKeyRepository: {} as any,
    });

    const merchant = Merchant.create({
      name: "Media Kit Merchant",
      email: new Email("merchant@example.com"),
      document: new Document("52998224725"),
      passwordHash: "hashed-password",
    });
    await merchants.save(merchant);

    const createStore = new CreateStoreUseCase(
      {
        execute: async (work) => work(makeRepos()),
      },
      {
        async generateAccessToken(_, storeId) {
          return `access-token:${storeId}`;
        },
        async generateRefreshToken() {
          return "refresh-token";
        },
        async verifyToken() {
          throw new Error("not used");
        },
        decodeToken() {
          return null;
        },
      },
      tokenGenerator,
      {
        generateFromName: (name: string) =>
          name.toLowerCase().replace(/\s+/g, "-"),
        generateUnique: async (slug: string) => slug,
        validateFormat: () => true,
        isAvailable: async () => true,
      },
    );

    const storeResult = await createStore.execute({
      merchantId: merchant.id,
      name: "Media Kit",
      slug: "media-kit",
    });
    const storeId = storeResult.store.id;

    expect(await accounts.findByStoreId(storeId)).not.toBeNull();

    const apiKeyResult = await new CreateApiKeyUseCase(
      apiKeys,
      tokenGenerator,
    ).execute({
      storeId,
      name: "P0 key",
      environment: Environment.TEST,
    });

    expect(apiKeyResult.plainKey).toMatch(/^hk_test_/);

    const createPayment = new CreatePaymentUseCase(
      {
        execute: async (work) => work(makeRepos()),
      },
      {
        async generate() {
          return {
            qrCodeBase64: "qr-code",
            copyPaste: "pix-copy-paste",
            txId: "pix-tx-id",
          };
        },
      },
      {
        async scheduleExpiration() {},
      },
      new FeePolicy(),
      "test@hockpay.local",
    );
    const createSession = new CreateCheckoutSessionUseCase(
      sessions,
      stores,
      tokenGenerator,
      "http://localhost:3333",
    );
    const getSession = new GetCheckoutSessionUseCase(
      sessions,
      stores,
      payments,
    );
    const fulfillSession = new FulfillCheckoutSessionUseCase(
      {
        execute: async (work) => work(makeRepos()),
      },
      createPayment,
    );

    const session = await createSession.execute({
      storeId,
      amount: 7_990,
      description: "Media kit premium",
      metadata: { studyCase: "demo-mediakit" },
    });
    const loadedOpenSession = await getSession.execute(session.checkoutToken);

    expect(loadedOpenSession.status).toBe("OPEN");

    const fulfilled = await fulfillSession.execute({
      token: session.checkoutToken,
      customer: {
        document: "52998224725",
        name: "Cliente Demo",
        email: "cliente@example.com",
      },
      environment: Environment.TEST,
    });
    const loadedFulfilledSession = await getSession.execute(
      session.checkoutToken,
    );

    expect(loadedFulfilledSession.paymentId).toBe(fulfilled.paymentId);

    const confirmed = await new ConfirmPaymentUseCase({
      execute: async (work) => work(makeRepos()),
    }).execute({
      storeId,
      paymentId: fulfilled.paymentId,
    });
    const account = await accounts.findByStoreId(storeId);
    const receipt = await receipts.findByPaymentId(fulfilled.paymentId);

    expect(confirmed.payment.status).toBe("CONFIRMED");
    expect(account?.pending).toBe(7_855);
    expect(receipt).not.toBeNull();
    expect(outbox.events.map((event) => event.eventType)).toContain(
      "payment.confirmed",
    );
  });
});

class DeterministicTokenGenerator {
  private sequence = 0;

  generate(): string {
    this.sequence += 1;
    return this.sequence.toString(16).padStart(32, "0");
  }

  generateBase64(): string {
    this.sequence += 1;
    return `token-${this.sequence}`;
  }

  hash(value: string): string {
    return `hash:${value}`;
  }
}

class InMemoryMerchantRepository {
  private readonly items = new Map<string, Merchant>();

  async save(merchant: Merchant): Promise<void> {
    this.items.set(merchant.id, merchant);
  }

  async findById(id: string): Promise<Merchant | null> {
    return this.items.get(id) ?? null;
  }

  async findByIdForUpdate(id: string): Promise<Merchant | null> {
    return this.findById(id);
  }

  async findByEmail(email: string): Promise<Merchant | null> {
    return (
      [...this.items.values()].find(
        (merchant) => merchant.email.toString() === email,
      ) ?? null
    );
  }

  async findByDocument(document: string): Promise<Merchant | null> {
    return (
      [...this.items.values()].find(
        (merchant) => merchant.document.value === document,
      ) ?? null
    );
  }

  async existsByEmailOrDocument(
    email: string,
    document: string,
  ): Promise<boolean> {
    return Boolean(
      (await this.findByEmail(email)) ?? (await this.findByDocument(document)),
    );
  }

  async update(merchant: Merchant): Promise<void> {
    this.items.set(merchant.id, merchant);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryStoreRepository {
  private readonly items = new Map<string, Store>();

  async save(store: Store): Promise<void> {
    this.items.set(store.id, store);
  }

  async findById(id: string): Promise<Store | null> {
    return this.items.get(id) ?? null;
  }

  async findByIdAndMerchantId(
    id: string,
    merchantId: string,
  ): Promise<Store | null> {
    const store = this.items.get(id);
    return store?.merchantId === merchantId ? store : null;
  }

  async findBySlug(slug: string): Promise<Store | null> {
    return (
      [...this.items.values()].find((store) => store.slug === slug) ?? null
    );
  }

  async findByMerchantId(merchantId: string): Promise<Store[]> {
    return [...this.items.values()].filter(
      (store) => store.merchantId === merchantId,
    );
  }

  async update(store: Store): Promise<void> {
    this.items.set(store.id, store);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryAccountRepository {
  private readonly items = new Map<string, Account>();

  async save(account: Account): Promise<void> {
    this.items.set(account.id, account);
  }

  async update(account: Account): Promise<void> {
    this.items.set(account.id, account);
  }

  async findById(id: string): Promise<Account | null> {
    return this.items.get(id) ?? null;
  }

  async findByIdForUpdate(id: string): Promise<Account | null> {
    return this.findById(id);
  }

  async findByStoreId(storeId: string): Promise<Account | null> {
    return (
      [...this.items.values()].find((account) => account.storeId === storeId) ??
      null
    );
  }

  async findByStoreIdForUpdate(storeId: string): Promise<Account | null> {
    return this.findByStoreId(storeId);
  }

  async findWithPendingBalance(): Promise<Account[]> {
    return [...this.items.values()].filter((account) => account.pending > 0);
  }
}

class InMemoryApiKeyRepository {
  private readonly items = new Map<string, ApiKey>();

  async save(apiKey: ApiKey): Promise<void> {
    this.items.set(apiKey.id, apiKey);
  }

  async findById(id: string): Promise<ApiKey | null> {
    return this.items.get(id) ?? null;
  }

  async findByKeyHash(keyHash: string): Promise<ApiKey | null> {
    return (
      [...this.items.values()].find((apiKey) => apiKey.keyHash === keyHash) ??
      null
    );
  }

  async findByStoreId(storeId: string): Promise<ApiKey[]> {
    return [...this.items.values()].filter(
      (apiKey) => apiKey.storeId === storeId,
    );
  }

  async update(apiKey: ApiKey): Promise<void> {
    this.items.set(apiKey.id, apiKey);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryRefreshTokenRepository {
  private readonly items = new Map<string, RefreshToken>();

  async create(token: RefreshToken): Promise<void> {
    this.items.set(token.token, token);
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.items.get(token) ?? null;
  }

  async findByTokenForUpdate(token: string): Promise<RefreshToken | null> {
    return this.findByToken(token);
  }

  async findByMerchantId(merchantId: string): Promise<RefreshToken | null> {
    return (
      [...this.items.values()].find(
        (token) => token.merchantId === merchantId,
      ) ?? null
    );
  }

  async update(token: RefreshToken): Promise<void> {
    this.items.set(token.token, token);
  }

  async revokeAllForMerchant(): Promise<void> {}

  async deleteExpired(): Promise<void> {}
}

class InMemoryCheckoutSessionRepository {
  private readonly items = new Map<string, CheckoutSession>();

  async save(session: CheckoutSession): Promise<void> {
    this.items.set(session.id, session);
  }

  async findById(id: string): Promise<CheckoutSession | null> {
    return this.items.get(id) ?? null;
  }

  async findByToken(token: string): Promise<CheckoutSession | null> {
    return (
      [...this.items.values()].find(
        (session) => session.checkoutToken === token,
      ) ?? null
    );
  }

  async claimOpenByToken(
    token: string,
    now: Date,
  ): Promise<CheckoutSession | null> {
    const session = await this.findByToken(token);
    if (
      !session ||
      session.status !== "OPEN" ||
      session.paymentId ||
      session.expiresAt <= now
    ) {
      return null;
    }

    return session;
  }

  async expireOpenByToken(
    token: string,
    now: Date,
  ): Promise<CheckoutSession | null> {
    const session = await this.findByToken(token);
    if (!session || session.status !== "OPEN" || session.expiresAt > now) {
      return null;
    }

    session.expire();
    await this.save(session);
    return session;
  }

  async findByPaymentId(paymentId: string): Promise<CheckoutSession | null> {
    return (
      [...this.items.values()].find(
        (session) => session.paymentId === paymentId,
      ) ?? null
    );
  }
}

class InMemoryPaymentRepository {
  private readonly items = new Map<string, Payment>();

  async save(payment: Payment): Promise<void> {
    this.items.set(payment.id, payment);
  }

  async findById(id: string): Promise<Payment | null> {
    return this.items.get(id) ?? null;
  }

  async findByIdForUpdate(id: string): Promise<Payment | null> {
    return this.findById(id);
  }

  async findByIdAndStoreId(
    id: string,
    storeId: string,
  ): Promise<Payment | null> {
    const payment = this.items.get(id);
    return payment?.storeId === storeId ? payment : null;
  }

  async findByIdAndStoreIdForUpdate(
    id: string,
    storeId: string,
  ): Promise<Payment | null> {
    return this.findByIdAndStoreId(id, storeId);
  }

  async findByExternalIdAndStoreId(): Promise<Payment | null> {
    return null;
  }

  async findByPixTxId(pixTxId: string): Promise<Payment | null> {
    return (
      [...this.items.values()].find(
        (payment) => payment.pixCharge?.pixTxId === pixTxId,
      ) ?? null
    );
  }

  async list(): Promise<any> {
    return {
      payments: [...this.items.values()],
      total: this.items.size,
      page: 1,
      limit: this.items.size,
      totalPages: 1,
    };
  }

  async findByPixChargeIdAndStoreId(
    pixChargeId: string,
    storeId: string,
  ): Promise<Payment[]> {
    return [...this.items.values()]
      .filter(
        (payment) =>
          payment.pixChargeId === pixChargeId && payment.storeId === storeId,
      )
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
  }

  async listByPixChargeIdsAndStoreId(
    pixChargeIds: string[],
    storeId: string,
  ): Promise<Payment[]> {
    const ids = new Set(pixChargeIds);
    return [...this.items.values()]
      .filter(
        (payment) =>
          Boolean(payment.pixChargeId) &&
          ids.has(payment.pixChargeId!) &&
          payment.storeId === storeId,
      )
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
  }

  async update(payment: Payment): Promise<void> {
    this.items.set(payment.id, payment);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async externalIdExists(): Promise<boolean> {
    return false;
  }
}

class InMemoryPixChargeRepository {
  private readonly items = new Map<string, PixCharge>();

  async save(charge: PixCharge): Promise<void> {
    this.items.set(charge.id, charge);
  }

  async update(charge: PixCharge): Promise<void> {
    this.items.set(charge.id, charge);
  }

  async findById(id: string): Promise<PixCharge | null> {
    return this.items.get(id) ?? null;
  }

  async findByIdAndStoreId(
    id: string,
    storeId: string,
  ): Promise<PixCharge | null> {
    const charge = this.items.get(id);
    return charge?.storeId === storeId ? charge : null;
  }

  async findByIdAndStoreIdForUpdate(
    id: string,
    storeId: string,
  ): Promise<PixCharge | null> {
    return this.findByIdAndStoreId(id, storeId);
  }

  async findByPixTxId(pixTxId: string): Promise<PixCharge | null> {
    return (
      [...this.items.values()].find((charge) => charge.pixTxId === pixTxId) ??
      null
    );
  }
}

class InMemoryCustomerRepository {
  private readonly items = new Map<string, Customer>();

  async save(customer: Customer): Promise<void> {
    this.items.set(customer.id, customer);
  }

  async findById(id: string): Promise<Customer | null> {
    return this.items.get(id) ?? null;
  }

  async findByExternalId(
    storeId: string,
    externalId: string,
  ): Promise<Customer | null> {
    return (
      [...this.items.values()].find(
        (customer) =>
          customer.storeId === storeId && customer.externalId === externalId,
      ) ?? null
    );
  }

  async findByDocument(
    storeId: string,
    document: string,
  ): Promise<Customer | null> {
    return (
      [...this.items.values()].find(
        (customer) =>
          customer.storeId === storeId && customer.document.value === document,
      ) ?? null
    );
  }

  async update(customer: Customer): Promise<void> {
    this.items.set(customer.id, customer);
  }

  async list(): Promise<any> {
    return {
      customers: [...this.items.values()],
      total: this.items.size,
      page: 1,
      limit: this.items.size,
      totalPages: 1,
    };
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryReceiptRepository {
  private readonly items = new Map<string, Receipt>();
  private sequence = 0;

  async findById(id: string): Promise<Receipt | null> {
    return this.items.get(id) ?? null;
  }

  async findByPaymentId(paymentId: string): Promise<Receipt | null> {
    return (
      [...this.items.values()].find(
        (receipt) => receipt.paymentId === paymentId,
      ) ?? null
    );
  }

  async findByReceiptNumber(receiptNumber: string): Promise<Receipt | null> {
    return (
      [...this.items.values()].find(
        (receipt) => receipt.receiptNumber === receiptNumber,
      ) ?? null
    );
  }

  async findByStoreId(): Promise<{ items: Receipt[]; total: number }> {
    return {
      items: [...this.items.values()],
      total: this.items.size,
    };
  }

  async save(receipt: Receipt): Promise<void> {
    this.items.set(receipt.id, receipt);
  }

  async update(receipt: Receipt): Promise<void> {
    this.items.set(receipt.id, receipt);
  }

  async incrementCounter(): Promise<number> {
    this.sequence += 1;
    return this.sequence;
  }
}

class InMemoryOutboxWriter {
  readonly events: OutboxEvent[] = [];

  async save(event: OutboxEvent): Promise<void> {
    this.events.push(event);
  }
}

class InMemoryTransactionRepository {
  readonly transactions: unknown[] = [];

  async save(transaction: unknown): Promise<void> {
    this.transactions.push(transaction);
  }
}
