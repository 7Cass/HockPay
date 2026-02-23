import { Injectable, Logger } from '@nestjs/common';
import {
  IWebhookSenderPort,
  WebhookResponse,
} from '@hockpay/core';

/**
 * Implementation of IWebhookSenderPort using native fetch.
 */
@Injectable()
export class WebhookHttpClientService implements IWebhookSenderPort {
  private readonly logger = new Logger(WebhookHttpClientService.name);
  private readonly timeout = 30000; // 30 seconds

  /**
   * Send a webhook to the target URL.
   */
  async send(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const body = await response.text();

      if (response.ok) {
        this.logger.debug(`Webhook sent successfully to ${url}`);
        return {
          statusCode: response.status,
          body,
          success: true,
        };
      }

      this.logger.warn(`Webhook returned ${response.status} for ${url}: ${body}`);
      return {
        statusCode: response.status,
        body,
        success: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send webhook to ${url}: ${errorMessage}`);

      return {
        statusCode: 0,
        body: errorMessage,
        success: false,
      };
    }
  }
}
