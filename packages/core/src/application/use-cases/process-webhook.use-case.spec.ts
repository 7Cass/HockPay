import { describe, expect, it, vi } from "vitest";
import {
  OutboxEvent,
  OutboxEventStatus,
} from "../../domain/entities/outbox-event.entity";
import { WebhookConfig } from "../../domain/entities/webhook-config.entity";
import { ProcessWebhookUseCase } from "./process-webhook.use-case";

describe("ProcessWebhookUseCase", () => {
  it("leaves outbox status unchanged on transient delivery failure", async () => {
    const event = OutboxEvent.create({
      aggregateType: "Payment",
      aggregateId: "payment-1",
      eventType: "payment.created",
      payload: {
        id: "payment-1",
        storeId: "store-1",
        amount: 1000,
      },
    });
    event.markAsDispatched(new Date("2026-01-01T00:45:00.000Z"));

    const config = WebhookConfig.create({
      storeId: "store-1",
      url: "https://example.com/webhook",
      secret: "encrypted-secret",
      prefix: "whsec_test",
      events: ["payment.created"],
    });

    const outboxRepository = {
      findById: vi.fn().mockResolvedValue(event),
      update: vi.fn(),
    };
    const webhookLogRepository = {
      save: vi.fn(),
    };
    const useCase = new ProcessWebhookUseCase(
      outboxRepository as any,
      {
        findActiveForEvent: vi.fn().mockResolvedValue([config]),
      } as any,
      webhookLogRepository as any,
      {
        send: vi.fn().mockResolvedValue({
          success: false,
          statusCode: 500,
          body: "server error",
        }),
      } as any,
      {
        sign: vi.fn().mockReturnValue("signature"),
      } as any,
      {
        decrypt: vi.fn().mockReturnValue("plain-secret"),
      } as any,
    );

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(false);
    expect(result.event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(outboxRepository.update).not.toHaveBeenCalled();
    expect(webhookLogRepository.save).toHaveBeenCalledTimes(1);
  });
});
