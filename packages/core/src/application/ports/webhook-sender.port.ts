/**
 * Port: Webhook Sender
 *
 * Interface for sending HTTP webhooks.
 * This port is implemented in the infrastructure layer using fetch/axios.
 */
export interface IWebhookSenderPort {
  /**
   * Send a webhook to the target URL.
   *
   * @param url - The webhook URL
   * @param payload - The payload to send
   * @param headers - Additional headers to include
   * @returns The response status code and body
   */
  send(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookResponse>;
}

/**
 * Webhook response structure.
 */
export interface WebhookResponse {
  statusCode: number;
  body?: string;
  success: boolean;
}
