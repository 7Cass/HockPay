import { describe, expect, it, vi } from "vitest";
import { InvalidWebhookUrlError } from "../../domain/errors/invalid-webhook-url.error";
import { WebhookConfig } from "../../domain/entities/webhook-config.entity";
import { CreateWebhookConfigUseCase } from "./create-webhook-config.use-case";
import { UpdateWebhookConfigUseCase } from "./update-webhook-config.use-case";

describe("webhook config URL policy", () => {
  it("rejects private targets on webhook create", async () => {
    const webhookConfigRepository = {
      save: vi.fn(),
    };
    const useCase = new CreateWebhookConfigUseCase(
      webhookConfigRepository as any,
      { generate: vi.fn().mockReturnValue("a".repeat(32)) } as any,
      { encrypt: vi.fn().mockReturnValue("encrypted-secret") } as any,
    );

    await expect(
      useCase.execute({
        storeId: "store-1",
        url: "https://10.0.0.1/webhook",
        events: ["payment.confirmed"],
      }),
    ).rejects.toBeInstanceOf(InvalidWebhookUrlError);
    expect(webhookConfigRepository.save).not.toHaveBeenCalled();
  });

  it("allows local HTTP on webhook create only when enabled", async () => {
    const webhookConfigRepository = {
      save: vi.fn(),
    };
    const useCase = new CreateWebhookConfigUseCase(
      webhookConfigRepository as any,
      { generate: vi.fn().mockReturnValue("a".repeat(32)) } as any,
      { encrypt: vi.fn().mockReturnValue("encrypted-secret") } as any,
      { allowLocalHttp: true },
    );

    await expect(
      useCase.execute({
        storeId: "store-1",
        url: "http://localhost:3999/webhook",
        events: ["payment.confirmed"],
      }),
    ).resolves.toMatchObject({
      webhookConfig: {
        url: "http://localhost:3999/webhook",
      },
    });
  });

  it("rejects private targets on webhook update", async () => {
    const webhookConfig = WebhookConfig.reconstitute({
      id: "webhook-config-1",
      storeId: "store-1",
      url: "https://hooks.example.com/webhook",
      secret: "encrypted-secret",
      prefix: "whsec_test",
      events: ["payment.confirmed"],
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const webhookConfigRepository = {
      findById: vi.fn().mockResolvedValue(webhookConfig),
      update: vi.fn(),
    };
    const useCase = new UpdateWebhookConfigUseCase(
      webhookConfigRepository as any,
    );

    await expect(
      useCase.execute({
        configId: "webhook-config-1",
        storeId: "store-1",
        url: "https://192.168.1.10/webhook",
      }),
    ).rejects.toBeInstanceOf(InvalidWebhookUrlError);
    expect(webhookConfigRepository.update).not.toHaveBeenCalled();
  });
});
