import { afterEach, describe, expect, it, vi } from "vitest";
import { WebhookDeliveryStatus, WebhookLog } from "./webhook-log.entity";

describe("WebhookLog", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeLog(maxAttempts = 3) {
    return WebhookLog.create({
      configId: "config-1",
      outboxEventId: "outbox-1",
      eventType: "payment.created",
      payload: { id: "payment-1" },
      maxAttempts,
    });
  }

  it("tracks a concrete attempt before recording the response", () => {
    const log = makeLog();

    log.beginAttempt("req-1");

    expect(log.attempt).toBe(1);
    expect(log.requestId).toBe("req-1");
    expect(log.status).toBe(WebhookDeliveryStatus.PENDING);
  });

  it("marks successful delivery as delivered without scheduling retry", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-05-20T10:00:00.000Z"));
    const log = makeLog();

    log.beginAttempt("req-1");
    log.recordSuccess(200, "ok");

    expect(log.status).toBe(WebhookDeliveryStatus.DELIVERED);
    expect(log.isDelivered()).toBe(true);
    expect(log.responseStatus).toBe(200);
    expect(log.deliveredAt).toEqual(new Date("2026-05-20T10:00:00.000Z"));
    expect(log.nextRetryAt).toBeUndefined();
    expect(log.failedAt).toBeUndefined();
    expect(log.lastError).toBeUndefined();
  });

  it("marks failed attempts as retryable until max attempts is reached", () => {
    const log = makeLog(2);

    log.beginAttempt("req-1");
    log.recordFailure(500, "server error");

    expect(log.status).toBe(WebhookDeliveryStatus.FAILED_RETRYABLE);
    expect(log.attempt).toBe(1);
    expect(log.lastError).toBe("server error");
    expect(log.nextRetryAt).toBeInstanceOf(Date);
    expect(log.canRetry()).toBe(true);

    log.beginAttempt("req-2");
    log.recordFailure(500, "still failing");

    expect(log.status).toBe(WebhookDeliveryStatus.FAILED_FINAL);
    expect(log.attempt).toBe(2);
    expect(log.failedAt).toBeInstanceOf(Date);
    expect(log.nextRetryAt).toBeUndefined();
    expect(log.canRetry()).toBe(false);
  });

  it("records final queue failure with the attempts made by BullMQ", () => {
    const log = makeLog(5);

    log.markFinalFailure("delivery failed", 5);

    expect(log.status).toBe(WebhookDeliveryStatus.FAILED_FINAL);
    expect(log.attempt).toBe(5);
    expect(log.failedAt).toBeInstanceOf(Date);
    expect(log.lastError).toBe("delivery failed");
    expect(log.canRetry()).toBe(false);
  });

  it("resets non-delivered delivery state before DLQ requeue", () => {
    const log = makeLog(5);
    log.beginAttempt("req-1");
    log.recordFailure(500, "server error");

    log.resetForRequeue();

    expect(log.status).toBe(WebhookDeliveryStatus.PENDING);
    expect(log.attempt).toBe(0);
    expect(log.nextRetryAt).toBeUndefined();
    expect(log.failedAt).toBeUndefined();
    expect(log.lastError).toBeUndefined();
    expect(log.responseStatus).toBeUndefined();
    expect(log.responseBody).toBeUndefined();
  });

  it("does not reset delivered logs before DLQ requeue", () => {
    const log = makeLog();
    log.beginAttempt("req-1");
    log.recordSuccess(200, "ok");

    log.resetForRequeue();

    expect(log.status).toBe(WebhookDeliveryStatus.DELIVERED);
    expect(log.attempt).toBe(1);
    expect(log.responseStatus).toBe(200);
    expect(log.responseBody).toBe("ok");
  });
});
