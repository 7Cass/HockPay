import {
  IWebhookSenderPort,
  WebhookResponse,
  WebhookUrlPolicyOptions,
  validateWebhookUrl,
} from "@hockpay/core";

type WebhookHttpLogger = {
  debug(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

export interface WebhookHttpClientOptions {
  timeoutMs?: number;
  logger?: WebhookHttpLogger;
  webhookUrlPolicyOptions?: WebhookUrlPolicyOptions;
}

/**
 * Implementation of IWebhookSenderPort using native fetch.
 */
export class WebhookHttpClientService implements IWebhookSenderPort {
  private readonly timeoutMs: number;
  private readonly logger?: WebhookHttpLogger;
  private readonly webhookUrlPolicyOptions: WebhookUrlPolicyOptions;

  constructor(options: WebhookHttpClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.logger = options.logger;
    this.webhookUrlPolicyOptions = options.webhookUrlPolicyOptions ?? {};
  }

  async send(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookResponse> {
    const policyResult = validateWebhookUrl(url, this.webhookUrlPolicyOptions);
    if (!policyResult.valid) {
      const message = policyResult.message ?? "Webhook URL is not allowed";
      this.logger?.warn(`Blocked webhook target ${url}: ${message}`);

      return {
        statusCode: 0,
        body: message,
        success: false,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const body = await response.text();

      if (response.ok) {
        this.logger?.debug(`Webhook sent successfully to ${url}`);
        return {
          statusCode: response.status,
          body,
          success: true,
        };
      }

      this.logger?.warn(
        `Webhook returned ${response.status} for ${url}: ${body}`,
      );
      return {
        statusCode: response.status,
        body,
        success: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger?.error(`Failed to send webhook to ${url}: ${errorMessage}`);

      return {
        statusCode: 0,
        body: errorMessage,
        success: false,
      };
    }
  }
}
