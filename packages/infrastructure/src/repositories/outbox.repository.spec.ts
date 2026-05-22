import { describe, expect, it, vi } from "vitest";
import { OutboxEvent, OutboxEventStatus } from "@hockpay/core";
import { OutboxRepository } from "./outbox.repository";

function renderSql(query: unknown): string {
  const sqlQuery = query as {
    sql?: string;
    text?: string;
    strings?: readonly string[];
  };

  return sqlQuery.sql ?? sqlQuery.text ?? sqlQuery.strings?.join("?") ?? String(query);
}

describe("OutboxRepository", () => {
  it("queries pending, retryable failed, and stale dispatched events", async () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    const prisma = {
      outboxEvent: {
        fields: {
          maxRetries: "maxRetries-field",
        },
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const repository = new OutboxRepository(prisma as any);

    await repository.findDispatchableEvents(50, now);

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            status: "PENDING",
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          {
            status: "FAILED",
            retryCount: { lt: "maxRetries-field" },
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          {
            status: "DISPATCHED",
            processedAt: null,
            nextRetryAt: { lte: now },
          },
          {
            status: "DISPATCHED",
            processedAt: null,
            nextRetryAt: null,
            createdAt: { lte: new Date("2026-01-01T00:15:00.000Z") },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
  });

  it("claims dispatchable events atomically with row locks", async () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    const watchdogUntil = new Date("2026-01-01T01:45:00.000Z");
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    const repository = new OutboxRepository(prisma as any);

    await repository.claimDispatchableEvents({
      limit: 25,
      now,
      watchdogUntil,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    const query = prisma.$queryRaw.mock.calls[0][0];
    const sql = renderSql(query);

    expect(sql).toMatch(/WITH\s+claimable\s+AS/);
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toMatch(/UPDATE\s+"outbox_events"\s+AS\s+oe/);
    expect(sql).toContain('"retry_count" < "max_retries"');
    expect(sql).toContain('RETURNING');
    expect(sql).toContain('oe."aggregate_type" AS "aggregateType"');
    expect((query as { values?: unknown[] }).values).toEqual(
      expect.arrayContaining([now, watchdogUntil, 25]),
    );
  });

  it("maps claimed rows to outbox events", async () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    const watchdogUntil = new Date("2026-01-01T01:45:00.000Z");
    const createdAt = new Date("2026-01-01T00:30:00.000Z");
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "outbox-1",
          aggregateType: "Payment",
          aggregateId: "payment-1",
          eventType: "payment.created",
          requestId: null,
          payload: { id: "payment-1", storeId: "store-1" },
          status: "DISPATCHED",
          processedAt: null,
          retryCount: 1,
          maxRetries: 5,
          nextRetryAt: watchdogUntil,
          errorMessage: null,
          createdAt,
        },
      ]),
    };
    const repository = new OutboxRepository(prisma as any);

    const [event] = await repository.claimDispatchableEvents({
      limit: 1,
      now,
      watchdogUntil,
    });

    expect(event).toBeInstanceOf(OutboxEvent);
    expect(event.id).toBe("outbox-1");
    expect(event.aggregateType).toBe("Payment");
    expect(event.aggregateId).toBe("payment-1");
    expect(event.eventType).toBe("payment.created");
    expect(event.requestId).toBeUndefined();
    expect(event.payload).toEqual({ id: "payment-1", storeId: "store-1" });
    expect(event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(event.retryCount).toBe(1);
    expect(event.maxRetries).toBe(5);
    expect(event.nextRetryAt).toEqual(watchdogUntil);
    expect(event.errorMessage).toBeUndefined();
    expect(event.createdAt).toEqual(createdAt);
  });

  it("does not query when claiming with a non-positive limit", async () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };
    const repository = new OutboxRepository(prisma as any);

    const events = await repository.claimDispatchableEvents({
      limit: 0,
      watchdogUntil: new Date("2026-01-01T01:45:00.000Z"),
    });

    expect(events).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("persists request ids with outbox events", async () => {
    const event = OutboxEvent.create({
      aggregateType: "Payment",
      aggregateId: "payment-1",
      eventType: "payment.created",
      requestId: "req-1",
      payload: { id: "payment-1" },
    });
    const prisma = {
      outboxEvent: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
    const repository = new OutboxRepository(prisma as any);

    await repository.save(event);

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: event.id,
        requestId: "req-1",
      }),
    });
  });
});
