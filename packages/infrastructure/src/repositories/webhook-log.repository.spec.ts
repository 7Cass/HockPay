import { describe, expect, it, vi } from "vitest";
import { WebhookDeliveryStatus, WebhookLog } from "@hockpay/core";
import { WebhookLogRepository } from "./webhook-log.repository";

describe("WebhookLogRepository", () => {
  function makeRepository() {
    const prisma = {
      webhookLog: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };

    return {
      prisma,
      repository: new WebhookLogRepository(prisma as any),
    };
  }

  it("paginates config logs in the database", async () => {
    const { prisma, repository } = makeRepository();

    await repository.findByConfigId("config-1", {
      page: 2,
      limit: 25,
    });

    expect(prisma.webhookLog.findMany).toHaveBeenCalledWith({
      where: { configId: "config-1" },
      orderBy: { createdAt: "desc" },
      skip: 25,
      take: 25,
    });
  });

  it.each([
    ["delivered", { configId: "config-1", status: WebhookDeliveryStatus.DELIVERED }],
    [
      "failed",
      {
        configId: "config-1",
        status: {
          in: [
            WebhookDeliveryStatus.FAILED_RETRYABLE,
            WebhookDeliveryStatus.FAILED_FINAL,
          ],
        },
      },
    ],
    ["pending", { configId: "config-1", status: WebhookDeliveryStatus.PENDING }],
  ] as const)("applies the %s status filter to find and count", async (status, where) => {
    const { prisma, repository } = makeRepository();

    await repository.findByConfigId("config-1", {
      page: 1,
      limit: 10,
      status,
    });
    await repository.countByConfigId("config-1", status);

    expect(prisma.webhookLog.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 10,
    });
    expect(prisma.webhookLog.count).toHaveBeenCalledWith({ where });
  });

  it("persists trace identifiers for delivery logs", async () => {
    const log = WebhookLog.create({
      configId: "config-1",
      paymentId: "payment-1",
      outboxEventId: "outbox-1",
      requestId: "req-1",
      eventType: "payment.confirmed",
      payload: { id: "payment-1" },
    });
    const prisma = {
      webhookLog: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
    const repository = new WebhookLogRepository(prisma as any);

    await repository.save(log);

    expect(prisma.webhookLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: log.id,
        outboxEventId: "outbox-1",
        requestId: "req-1",
        status: WebhookDeliveryStatus.PENDING,
      }),
    });
  });

  it("upserts canonical delivery logs by config and outbox event", async () => {
    const log = WebhookLog.create({
      configId: "config-1",
      paymentId: "payment-1",
      outboxEventId: "outbox-1",
      eventType: "payment.confirmed",
      payload: { id: "payment-1" },
    });
    log.beginAttempt("req-1");
    log.recordSuccess(200, "ok");
    const prisma = {
      webhookLog: {
        upsert: vi.fn().mockResolvedValue(undefined),
      },
    };
    const repository = new WebhookLogRepository(prisma as any);

    await repository.upsertDelivery(log);

    expect(prisma.webhookLog.upsert).toHaveBeenCalledWith({
      where: {
        configId_outboxEventId: {
          configId: "config-1",
          outboxEventId: "outbox-1",
        },
      },
      create: expect.objectContaining({
        id: log.id,
        configId: "config-1",
        outboxEventId: "outbox-1",
        status: WebhookDeliveryStatus.DELIVERED,
        attempt: 1,
      }),
      update: expect.objectContaining({
        status: WebhookDeliveryStatus.DELIVERED,
        attempt: 1,
        deliveredAt: log.deliveredAt,
      }),
    });
  });

  it("persists trace identifiers and headers when updating delivery logs", async () => {
    const log = WebhookLog.create({
      configId: "config-1",
      eventType: "payment.confirmed",
      payload: { id: "payment-1" },
    });
    log.setRequestId("req-retry-1");
    log.setRequestHeaders({ "X-Request-ID": "req-retry-1" });
    log.recordFailure(500, "error");

    const prisma = {
      webhookLog: {
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    const repository = new WebhookLogRepository(prisma as any);

    await repository.update(log);

    expect(prisma.webhookLog.update).toHaveBeenCalledWith({
      where: { id: log.id },
      data: expect.objectContaining({
        requestId: "req-retry-1",
        requestHeaders: { "X-Request-ID": "req-retry-1" },
        status: WebhookDeliveryStatus.FAILED_RETRYABLE,
        lastError: "error",
      }),
    });
  });

  it("finds a delivery by config and outbox event", async () => {
    const row = {
      id: "log-1",
      configId: "config-1",
      paymentId: "payment-1",
      aggregateType: null,
      aggregateId: null,
      outboxEventId: "outbox-1",
      requestId: "req-1",
      eventType: "payment.confirmed",
      payload: {},
      requestHeaders: null,
      responseStatus: 200,
      responseBody: "ok",
      status: WebhookDeliveryStatus.DELIVERED,
      attempt: 1,
      maxAttempts: 5,
      nextRetryAt: null,
      deliveredAt: new Date("2026-01-01T00:00:00.000Z"),
      failedAt: null,
      lastError: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const prisma = {
      webhookLog: {
        findFirst: vi.fn().mockResolvedValue(row),
      },
    };
    const repository = new WebhookLogRepository(prisma as any);

    const log = await repository.findByConfigAndOutboxEvent(
      "config-1",
      "outbox-1",
    );

    expect(prisma.webhookLog.findFirst).toHaveBeenCalledWith({
      where: {
        configId: "config-1",
        outboxEventId: "outbox-1",
      },
    });
    expect(log?.id).toBe("log-1");
    expect(log?.status).toBe(WebhookDeliveryStatus.DELIVERED);
  });

  it("marks non-delivered outbox deliveries as final failures", async () => {
    const prisma = {
      webhookLog: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const repository = new WebhookLogRepository(prisma as any);

    const count = await repository.markOutboxDeliveriesFinalFailure(
      "outbox-1",
      "delivery failed",
      5,
    );

    expect(count).toBe(2);
    expect(prisma.webhookLog.updateMany).toHaveBeenCalledWith({
      where: {
        outboxEventId: "outbox-1",
        status: { not: WebhookDeliveryStatus.DELIVERED },
      },
      data: expect.objectContaining({
        status: WebhookDeliveryStatus.FAILED_FINAL,
        attempt: 5,
        nextRetryAt: null,
        lastError: "delivery failed",
      }),
    });
  });
});
