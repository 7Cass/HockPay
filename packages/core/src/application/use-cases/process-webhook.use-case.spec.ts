import { describe, expect, it, vi } from "vitest";
import {
  OutboxEvent,
  OutboxEventStatus,
} from "../../domain/entities/outbox-event.entity";
import { WebhookConfig } from "../../domain/entities/webhook-config.entity";
import { ProcessWebhookUseCase } from "./process-webhook.use-case";

describe("ProcessWebhookUseCase", () => {
  function makeEvent() {
    const event = OutboxEvent.create({
      aggregateType: "Payment",
      aggregateId: "payment-1",
      eventType: "payment.created",
      requestId: "req-1",
      payload: {
        id: "payment-1",
        storeId: "store-1",
        amount: 1000,
      },
    });
    event.markAsDispatched(new Date("2026-01-01T00:45:00.000Z"));
    return event;
  }

  function makeConfig(id: string, url: string, secret = `encrypted-${id}`) {
    return WebhookConfig.reconstitute({
      id,
      storeId: "store-1",
      url,
      secret,
      prefix: "whsec_test",
      events: ["payment.created"],
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  }

  function makeUseCase({
    event,
    configs,
    sender,
    encryption = { decrypt: vi.fn().mockReturnValue("plain-secret") },
  }: {
    event: OutboxEvent;
    configs: WebhookConfig[];
    sender: any;
    encryption?: any;
  }) {
    const outboxRepository = {
      findById: vi.fn().mockResolvedValue(event),
      update: vi.fn(),
    };
    const webhookConfigRepository = {
      findActiveForEvent: vi.fn().mockResolvedValue(configs),
    };
    const webhookLogRepository = {
      save: vi.fn(),
    };
    const useCase = new ProcessWebhookUseCase(
      outboxRepository as any,
      webhookConfigRepository as any,
      webhookLogRepository as any,
      sender,
      {
        sign: vi.fn().mockReturnValue("signature"),
      } as any,
      encryption,
    );

    return {
      useCase,
      outboxRepository,
      webhookConfigRepository,
      webhookLogRepository,
    };
  }

  it("leaves outbox status unchanged on transient delivery failure", async () => {
    const event = makeEvent();
    const config = makeConfig(
      "webhook-config-1",
      "https://example.com/webhook",
    );
    const { useCase, outboxRepository, webhookLogRepository } = makeUseCase({
      event,
      configs: [config],
      sender: {
        send: vi.fn().mockResolvedValue({
          success: false,
          statusCode: 500,
          body: "server error",
        }),
      } as any,
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(false);
    expect(result.event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(outboxRepository.update).not.toHaveBeenCalled();
    expect(webhookLogRepository.save).toHaveBeenCalledTimes(1);
  });

  it("marks the outbox as processed after all webhook configs succeed", async () => {
    const event = makeEvent();
    const sender = {
      send: vi.fn().mockResolvedValue({
        success: true,
        statusCode: 200,
        body: "ok",
      }),
    };
    const { useCase, outboxRepository, webhookLogRepository } = makeUseCase({
      event,
      configs: [
        makeConfig("webhook-config-1", "https://example.com/one"),
        makeConfig("webhook-config-2", "https://example.com/two"),
      ],
      sender: sender as any,
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(true);
    expect(result.event.status).toBe(OutboxEventStatus.PROCESSED);
    expect(sender.send).toHaveBeenCalledTimes(2);
    expect(sender.send).toHaveBeenCalledWith(
      "https://example.com/one",
      expect.any(Object),
      expect.objectContaining({
        "X-Request-ID": "req-1",
      }),
    );
    expect(webhookLogRepository.save).toHaveBeenCalledTimes(2);
    expect(webhookLogRepository.save.mock.calls[0][0].requestId).toBe("req-1");
    expect(webhookLogRepository.save.mock.calls[0][0].outboxEventId).toBe(
      event.id,
    );
    expect(outboxRepository.update).toHaveBeenCalledWith(event);
  });

  it("logs non-payment aggregates without forcing paymentId", async () => {
    const event = OutboxEvent.create({
      aggregateType: "Withdrawal",
      aggregateId: "withdrawal-1",
      eventType: "withdrawal.completed",
      requestId: "req-withdrawal-1",
      payload: {
        id: "withdrawal-1",
        storeId: "store-1",
        amount: 10000,
      },
    });
    event.markAsDispatched(new Date("2026-01-01T00:45:00.000Z"));
    const { useCase, webhookLogRepository } = makeUseCase({
      event,
      configs: [makeConfig("webhook-config-1", "https://example.com/one")],
      sender: {
        send: vi.fn().mockResolvedValue({
          success: true,
          statusCode: 200,
          body: "ok",
        }),
      } as any,
    });

    await useCase.execute({ eventId: event.id });

    const log = webhookLogRepository.save.mock.calls[0][0];
    expect(log.paymentId).toBeUndefined();
    expect(log.aggregateType).toBe("Withdrawal");
    expect(log.aggregateId).toBe("withdrawal-1");
  });

  it("attempts every webhook config when one delivery fails", async () => {
    const event = makeEvent();
    const sender = {
      send: vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith("/one")
            ? { success: false, statusCode: 500, body: "server error" }
            : { success: true, statusCode: 200, body: "ok" },
        ),
      ),
    };
    const { useCase, outboxRepository, webhookLogRepository } = makeUseCase({
      event,
      configs: [
        makeConfig("webhook-config-1", "https://example.com/one"),
        makeConfig("webhook-config-2", "https://example.com/two"),
      ],
      sender: sender as any,
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(false);
    expect(result.error).toBe("HTTP 500");
    expect(result.event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(sender.send).toHaveBeenCalledTimes(2);
    expect(webhookLogRepository.save).toHaveBeenCalledTimes(2);
    expect(outboxRepository.update).not.toHaveBeenCalled();
  });

  it("isolates unexpected config delivery errors from other webhook configs", async () => {
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
    const sender = {
      send: vi.fn().mockResolvedValue({
        success: true,
        statusCode: 200,
        body: "ok",
      }),
    };
    const { useCase, outboxRepository, webhookLogRepository } = makeUseCase({
      event,
      configs: [
        makeConfig("webhook-config-1", "https://example.com/one", "bad-secret"),
        makeConfig(
          "webhook-config-2",
          "https://example.com/two",
          "good-secret",
        ),
      ],
      sender: sender as any,
      encryption: {
        decrypt: vi.fn((secret: string) => {
          if (secret === "bad-secret") {
            throw new Error("decrypt failed");
          }
          return "plain-secret";
        }),
      },
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(false);
    expect(result.error).toBe("decrypt failed");
    expect(result.event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(outboxRepository.update).not.toHaveBeenCalled();
    expect(webhookLogRepository.save).toHaveBeenCalledTimes(2);
  });

  it("does not infer storeId from nested payload data", async () => {
    const event = OutboxEvent.create({
      aggregateType: "Payment",
      aggregateId: "payment-1",
      eventType: "payment.created",
      payload: {
        payment: {
          id: "payment-1",
          storeId: "store-1",
        },
      },
    });
    event.markAsDispatched(new Date("2026-01-01T00:45:00.000Z"));
    const sender = {
      send: vi.fn(),
    };
    const { useCase, outboxRepository, webhookConfigRepository } = makeUseCase({
      event,
      configs: [makeConfig("webhook-config-1", "https://example.com/one")],
      sender: sender as any,
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(true);
    expect(result.event.status).toBe(OutboxEventStatus.PROCESSED);
    expect(webhookConfigRepository.findActiveForEvent).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
    expect(outboxRepository.update).toHaveBeenCalledWith(event);
  });
});
