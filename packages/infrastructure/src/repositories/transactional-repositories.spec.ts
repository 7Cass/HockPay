import { describe, expect, it, vi } from "vitest";
import { CustomerCollectionMode } from "@hockpay/core";
import { CheckoutSessionRepository } from "./checkout-session.repository";
import { MerchantRepository } from "./merchant.repository";
import { PaymentLinkRepository } from "./payment-link.repository";
import { RefreshTokenRepository } from "./refresh-token.repository";
import { UnitOfWork } from "./unit-of-work";

describe("transactional repository helpers", () => {
  it("exposes payment link repository inside UnitOfWork transactions", async () => {
    const tx = {};
    const prisma = {
      $transaction: vi.fn(async (handler: any) => handler(tx)),
    };
    const unitOfWork = new UnitOfWork(
      prisma as any,
      "http://checkout.test",
    );

    await unitOfWork.execute(async (repos) => {
      expect(repos.paymentLinkRepository).toBeInstanceOf(PaymentLinkRepository);
      return undefined;
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("locks and reconstitutes a merchant by id", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "merchant-1",
          email: "merchant@example.com",
          passwordHash: "hash",
          name: "Merchant",
          document: "52998224725",
          isActive: true,
          currentStoreId: "store-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]),
    };
    const repository = new MerchantRepository(prisma as any);

    const merchant = await repository.findByIdForUpdate("merchant-1");

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(merchant?.id).toBe("merchant-1");
    expect(merchant?.currentStoreId).toBe("store-1");
  });

  it("locks and reconstitutes a refresh token by token string", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "refresh-1",
          token: "token-1",
          merchantId: "merchant-1",
          expiresAt: new Date("2026-12-31T00:00:00.000Z"),
          revokedAt: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]),
    };
    const repository = new RefreshTokenRepository(prisma as any);

    const refreshToken = await repository.findByTokenForUpdate("token-1");

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(refreshToken?.token).toBe("token-1");
    expect(refreshToken?.merchantId).toBe("merchant-1");
  });

  it("claims only open, unexpired checkout sessions without payment", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const prisma = {
      checkoutSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue(makeCheckoutSessionRow()),
      },
    };
    const repository = new CheckoutSessionRepository(prisma as any);

    const session = await repository.claimOpenByToken("checkout-token", now);

    expect(prisma.checkoutSession.updateMany).toHaveBeenCalledWith({
      where: {
        checkoutToken: "checkout-token",
        status: "OPEN",
        paymentId: null,
        expiresAt: { gt: now },
      },
      data: {
        updatedAt: now,
      },
    });
    expect(session?.checkoutToken).toBe("checkout-token");
  });
});

function makeCheckoutSessionRow() {
  return {
    id: "session-1",
    storeId: "store-1",
    amount: 7990,
    currency: "BRL",
    description: "Checkout",
    customerCollectionMode: CustomerCollectionMode.IDENTIFIED,
    prefillCustomer: null,
    paymentId: null,
    checkoutToken: "checkout-token",
    status: "OPEN",
    expiresAt: new Date("2026-01-01T01:00:00.000Z"),
    successUrl: null,
    cancelUrl: null,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}
