import { describe, expect, it, vi } from "vitest";
import { PaymentStatus, PixChargeStatus } from "@hockpay/core";
import { PaymentLinkRepository } from "./payment-link.repository";

describe("PaymentLinkRepository", () => {
  it("locks a payment link by store before returning the domain entity", async () => {
    const row = makePaymentLinkRow();
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: row.id }]),
      paymentLink: {
        findFirst: vi.fn().mockResolvedValue(row),
      },
    };
    const repository = new PaymentLinkRepository(
      prisma as any,
      "http://localhost:3333",
    );

    const link = await repository.findByIdAndStoreIdForUpdate(
      row.id,
      row.storeId,
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.paymentLink.findFirst).toHaveBeenCalledWith({
      where: { id: row.id, storeId: row.storeId },
    });
    expect(link?.id).toBe(row.id);
  });

  it("locks a public payment link token before returning the list item", async () => {
    const row = {
      ...makePaymentLinkRow(),
      pixCharge: makePixChargeRow([]),
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: row.id }]),
      paymentLink: {
        findUnique: vi.fn().mockResolvedValue(row),
      },
    };
    const repository = new PaymentLinkRepository(
      prisma as any,
      "http://localhost:3333",
    );

    const item = await repository.findPublicByTokenForUpdate(row.publicToken);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.paymentLink.findUnique).toHaveBeenCalledWith({
      where: { id: row.id },
      include: expect.any(Object),
    });
    expect(item?.id).toBe(row.id);
    expect(item?.pixCharge.status).toBe(PixChargeStatus.OPEN);
  });

  it("calculates conversion from paid links over created links", () => {
    const repository = new PaymentLinkRepository({} as any, "http://localhost:3333");

    const stats = (repository as any).buildStats([
      { status: "PAID", openedAt: null, amount: 10000 },
      { status: "ACTIVE", openedAt: null, amount: 20000 },
      { status: "EXPIRED", openedAt: new Date(), amount: 30000 },
      { status: "CANCELLED", openedAt: null, amount: 40000 },
    ]);

    expect(stats.total).toBe(4);
    expect(stats.paid).toBe(1);
    expect(stats.opened).toBe(1);
    expect(stats.conversionRate).toBe(0.25);
    expect(stats.paidAmount).toBe(10000);
  });

  it("pages authenticated lists in SQL without loading payment items for every store row", async () => {
    const prisma = {
      paymentLink: {
        findMany: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
        count: vi.fn().mockResolvedValue(40),
      },
    };
    const repository = new PaymentLinkRepository(prisma as any, "http://localhost:3333");

    await repository.list({
      storeId: "store-1",
      page: 2,
      limit: 20,
    });

    expect(prisma.paymentLink.findMany).toHaveBeenNthCalledWith(1, {
      where: { storeId: "store-1" },
      include: expect.any(Object),
      skip: 20,
      take: 20,
      orderBy: { createdAt: "desc" },
    });
    expect(prisma.paymentLink.findMany).toHaveBeenNthCalledWith(2, {
      where: { storeId: "store-1" },
      select: expect.objectContaining({
        pixCharge: expect.objectContaining({
          select: expect.objectContaining({
            payments: {
              select: {
                id: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          }),
        }),
      }),
      orderBy: { createdAt: "desc" },
    });
    expect(prisma.paymentLink.count).toHaveBeenCalledWith({
      where: { storeId: "store-1" },
    });
  });

  it("returns zero conversion when there are no links", () => {
    const repository = new PaymentLinkRepository({} as any, "http://localhost:3333");

    const stats = (repository as any).buildStats([]);

    expect(stats.total).toBe(0);
    expect(stats.conversionRate).toBe(0);
  });

  it("maps all PixCharge payments as stable enriched attempts", () => {
    const repository = new PaymentLinkRepository({} as any, "http://localhost:3333");
    const row = {
      id: "link-1",
      storeId: "store-1",
      pixChargeId: "charge-1",
      publicToken: "public-token",
      amount: 5000,
      currency: "BRL",
      title: "Venda avulsa",
      description: null,
      internalReference: null,
      expiresAt: null,
      openedAt: null,
      cancelledAt: null,
      createdAt: new Date("2026-05-15T12:00:00.000Z"),
      updatedAt: new Date("2026-05-15T12:00:00.000Z"),
      pixCharge: makePixChargeRow([
          makePaymentRow("payment-2", PaymentStatus.CONFIRMED, "2026-05-15T12:02:00.000Z"),
          makePaymentRow("payment-1", PaymentStatus.FAILED, "2026-05-15T12:01:00.000Z"),
      ]),
    };

    const item = (repository as any).toListItem(row);

    expect(item.attempts.map((attempt: any) => attempt.id)).toEqual([
      "payment-1",
      "payment-2",
    ]);
    expect(item.attempts.map((attempt: any) => attempt.attemptNumber)).toEqual([1, 2]);
    expect(item.attempts[0].attemptCount).toBe(2);
    expect(item.attempts[1].isLatestAttempt).toBe(true);
    expect(item.attempts[0].paymentLinkId).toBe("link-1");
    expect(item.attempts[0].pixCharge.pixTxId).toBe("pix-tx-id");
  });
});

function makePaymentLinkRow() {
  return {
    id: "link-1",
    storeId: "store-1",
    pixChargeId: "charge-1",
    publicToken: "public-token",
    amount: 5000,
    currency: "BRL",
    environment: "TEST",
    title: "Venda avulsa",
    description: null,
    internalReference: null,
    expiresAt: null,
    openedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-05-15T12:00:00.000Z"),
    updatedAt: new Date("2026-05-15T12:00:00.000Z"),
  };
}

function makePixChargeRow(payments: ReturnType<typeof makePaymentRow>[]) {
  return {
    id: "charge-1",
    storeId: "store-1",
    amount: 5000,
    currency: "BRL",
    status: PixChargeStatus.OPEN,
    pixQrCode: "qr-code",
    pixCopyPaste: "pix-copy-paste",
    pixTxId: "pix-tx-id",
    expiresAt: null,
    paidAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-05-15T12:00:00.000Z"),
    updatedAt: new Date("2026-05-15T12:00:00.000Z"),
    payments,
  };
}

function makePaymentRow(id: string, status: PaymentStatus, createdAt: string) {
  return {
    id,
    storeId: "store-1",
    customerId: null,
    pixChargeId: "charge-1",
    externalId: null,
    amount: 5000,
    fee: 90,
    netAmount: 4910,
    currency: "BRL",
    description: "Venda avulsa",
    payerName: null,
    payerDocument: null,
    payerEmail: null,
    status,
    environment: "TEST",
    paymentMethod: "PIX",
    paymentDetails: null,
    acquirerId: null,
    totalRefunded: 0,
    expiresAt: new Date("2026-05-15T12:30:00.000Z"),
    paidAt: status === PaymentStatus.CONFIRMED ? new Date("2026-05-15T12:03:00.000Z") : null,
    releasedAt: null,
    failedReason: status === PaymentStatus.FAILED ? "simulated failure" : null,
    metadata: {
      origin: "payment_link",
      paymentLinkId: "link-1",
    },
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}
