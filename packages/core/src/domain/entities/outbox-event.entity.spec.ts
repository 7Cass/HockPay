import { describe, expect, it } from "vitest";
import { OutboxEvent, OutboxEventStatus } from "./outbox-event.entity";

describe("OutboxEvent", () => {
  it("marks a dispatched event with a retry watchdog and clears previous errors", () => {
    const event = OutboxEvent.create({
      aggregateType: "Payment",
      aggregateId: "payment-1",
      eventType: "payment.created",
      payload: { id: "payment-1" },
    });
    const retryAt = new Date("2026-01-01T00:45:00.000Z");

    event.markAsFailed("queue unavailable");
    event.markAsDispatched(retryAt);

    expect(event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(event.nextRetryAt).toBe(retryAt);
    expect(event.errorMessage).toBeUndefined();
  });

  it("marks a failed event with retry metadata", () => {
    const event = OutboxEvent.create({
      aggregateType: "Payment",
      aggregateId: "payment-1",
      eventType: "payment.created",
      payload: { id: "payment-1" },
    });
    const retryAt = new Date("2026-01-01T00:01:00.000Z");

    event.markAsFailed("Failed to insert webhook job into BullMQ", retryAt);

    expect(event.status).toBe(OutboxEventStatus.FAILED);
    expect(event.retryCount).toBe(1);
    expect(event.nextRetryAt).toBe(retryAt);
    expect(event.errorMessage).toBe("Failed to insert webhook job into BullMQ");
  });

  it("clears retry metadata when processed", () => {
    const event = OutboxEvent.create({
      aggregateType: "Payment",
      aggregateId: "payment-1",
      eventType: "payment.created",
      payload: { id: "payment-1" },
    });

    event.markAsFailed("temporary failure", new Date());
    event.markAsProcessed();

    expect(event.status).toBe(OutboxEventStatus.PROCESSED);
    expect(event.nextRetryAt).toBeUndefined();
    expect(event.errorMessage).toBeUndefined();
  });
});
