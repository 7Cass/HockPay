import { describe, expect, it, vi } from "vitest";
import { WebhookConfig } from "../../domain/entities/webhook-config.entity";
import { WebhookLog } from "../../domain/entities/webhook-log.entity";
import { WebhookConfigNotFoundError } from "../../domain/errors/webhook-config-not-found.error";
import { WebhookLogNotFoundError } from "../../domain/errors/webhook-log-not-found.error";
import { RetryWebhookLogUseCase } from "./retry-webhook-log.use-case";

describe("RetryWebhookLogUseCase", () => {
  function makeConfig(props: Partial<Parameters<typeof WebhookConfig.reconstitute>[0]> = {}) {
    return WebhookConfig.reconstitute({
      id: "config-route",
      storeId: "store-1",
      url: "https://receiver.example/webhook",
      secret: "encrypted-route-secret",
      prefix: "whsec_route",
      events: ["payment.created"],
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...props,
    });
  }

  function makeLog(props: Partial<Parameters<typeof WebhookLog.reconstitute>[0]> = {}) {
    return WebhookLog.reconstitute({
      id: "log-1",
      configId: "config-route",
      paymentId: "payment-1",
      eventType: "payment.created",
      payload: { id: "payment-1" },
      responseStatus: 500,
      responseBody: "failed",
      attempt: 1,
      maxAttempts: 5,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      ...props,
    });
  }

  function makeUseCase(config: WebhookConfig | null, log: WebhookLog | null) {
    const webhookLogRepository = {
      findById: vi.fn().mockResolvedValue(log),
      update: vi.fn().mockResolvedValue(undefined),
    };
    const webhookConfigRepository = {
      findById: vi.fn().mockResolvedValue(config),
    };
    const webhookSender = {
      send: vi.fn().mockResolvedValue({
        success: true,
        statusCode: 204,
        body: "ok",
      }),
    };
    const hmacSigner = {
      sign: vi.fn().mockReturnValue("signature-route-secret"),
    };
    const encryption = {
      decrypt: vi.fn().mockReturnValue("plain-route-secret"),
    };

    return {
      useCase: new RetryWebhookLogUseCase(
        webhookLogRepository as any,
        webhookConfigRepository as any,
        webhookSender as any,
        hmacSigner as any,
        encryption as any,
      ),
      webhookLogRepository,
      webhookConfigRepository,
      webhookSender,
      hmacSigner,
      encryption,
    };
  }

  it("retries a log scoped to the route config using the route config secret and URL", async () => {
    const config = makeConfig({
      url: "https://route.example/webhook",
      secret: "encrypted-route-secret",
    });
    const log = makeLog({ configId: config.id });
    const {
      useCase,
      webhookConfigRepository,
      webhookLogRepository,
      webhookSender,
      hmacSigner,
      encryption,
    } = makeUseCase(config, log);

    const result = await useCase.execute({
      configId: "config-route",
      logId: "log-1",
      storeId: "store-1",
      requestId: "req-1",
    });

    expect(webhookConfigRepository.findById).toHaveBeenCalledWith("config-route");
    expect(webhookLogRepository.findById).toHaveBeenCalledWith("log-1");
    expect(encryption.decrypt).toHaveBeenCalledWith("encrypted-route-secret");
    expect(hmacSigner.sign).toHaveBeenCalledWith(
      "plain-route-secret",
      { id: "payment-1" },
      expect.any(Number),
    );
    expect(webhookSender.send).toHaveBeenCalledWith(
      "https://route.example/webhook",
      { id: "payment-1" },
      expect.objectContaining({
        "X-Hockpay-Signature": "signature-route-secret",
        "X-Request-ID": "req-1",
      }),
    );
    expect(webhookLogRepository.update).toHaveBeenCalledWith(log);
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(204);
    expect(result.log).toBe(log);
  });

  it("throws WEBHOOK_CONFIG_NOT_FOUND when the route config does not exist", async () => {
    const { useCase, webhookLogRepository } = makeUseCase(null, makeLog());

    await expect(
      useCase.execute({
        configId: "missing-config",
        logId: "log-1",
        storeId: "store-1",
      }),
    ).rejects.toMatchObject({
      code: "WEBHOOK_CONFIG_NOT_FOUND",
    });
    await expect(
      useCase.execute({
        configId: "missing-config",
        logId: "log-1",
        storeId: "store-1",
      }),
    ).rejects.toBeInstanceOf(WebhookConfigNotFoundError);
    expect(webhookLogRepository.findById).not.toHaveBeenCalled();
  });

  it("throws WEBHOOK_CONFIG_NOT_FOUND when the route config belongs to another store", async () => {
    const { useCase, webhookLogRepository } = makeUseCase(
      makeConfig({ storeId: "store-2" }),
      makeLog(),
    );

    await expect(
      useCase.execute({
        configId: "config-route",
        logId: "log-1",
        storeId: "store-1",
      }),
    ).rejects.toBeInstanceOf(WebhookConfigNotFoundError);
    expect(webhookLogRepository.findById).not.toHaveBeenCalled();
  });

  it("throws WEBHOOK_LOG_NOT_FOUND when the log does not exist", async () => {
    const { useCase } = makeUseCase(makeConfig(), null);

    await expect(
      useCase.execute({
        configId: "config-route",
        logId: "missing-log",
        storeId: "store-1",
      }),
    ).rejects.toMatchObject({
      code: "WEBHOOK_LOG_NOT_FOUND",
    });
  });

  it("throws WEBHOOK_LOG_NOT_FOUND when the log belongs to another config in the same store", async () => {
    const { useCase, webhookSender } = makeUseCase(
      makeConfig({ id: "config-route", storeId: "store-1" }),
      makeLog({ configId: "config-other" }),
    );

    await expect(
      useCase.execute({
        configId: "config-route",
        logId: "log-1",
        storeId: "store-1",
      }),
    ).rejects.toBeInstanceOf(WebhookLogNotFoundError);
    expect(webhookSender.send).not.toHaveBeenCalled();
  });
});
