import { afterEach, describe, expect, it, vi } from "vitest";
import { WebhookHttpClientService } from "./webhook-http-client.service";

describe("WebhookHttpClientService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks SSRF-sensitive webhook targets before calling fetch", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));
    const client = new WebhookHttpClientService();

    const response = await client.send(
      "https://169.254.169.254/latest/meta-data",
      { test: true },
      { "Content-Type": "application/json" },
    );

    expect(response.success).toBe(false);
    expect(response.statusCode).toBe(0);
    expect(response.body).toContain("public remote host");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows local HTTP when the caller opts into local development policy", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const client = new WebhookHttpClientService({
      webhookUrlPolicyOptions: { allowLocalHttp: true },
    });

    const response = await client.send(
      "http://127.0.0.1:3999/webhook",
      { test: true },
      { "Content-Type": "application/json" },
    );

    expect(response.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
