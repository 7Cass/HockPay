import { describe, expect, it, vi } from "vitest";
import { OutboxRepository } from "./outbox.repository";

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
});
