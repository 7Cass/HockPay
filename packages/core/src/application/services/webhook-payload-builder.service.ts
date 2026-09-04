/**
 * Webhook Payload Builder
 *
 * Helper functions to build webhook payloads for domain events.
 * Follows Stripe-like envelope format with event metadata and full object in data.
 */

/**
 * Webhook event payload envelope (Stripe-like format).
 */
export interface WebhookEventPayload {
  id: string; // OutboxEvent ID
  type: string; // eventType (ex: "payment.confirmed")
  /**
   * Versao do contrato deste tipo de evento, congelada quando o evento foi
   * produzido. Um consumidor que so entende v1 pode ignorar o que vier em
   * v2 em vez de tentar ler uma forma que nao conhece.
   */
  version: number;
  created_at: string; // ISO string
  data: Record<string, unknown>;
}

/**
 * Build webhook event payload with envelope format.
 *
 * @param eventId - OutboxEvent ID (same ID used for retries)
 * @param eventType - Event type (ex: "payment.confirmed")
 * @param version - Envelope contract version frozen at production time
 * @param createdAt - Event creation timestamp
 * @param data - Full sanitized event object
 * @returns Webhook event payload envelope
 */
export function buildWebhookEventPayload(
  eventId: string,
  eventType: string,
  version: number,
  createdAt: Date,
  data: Record<string, unknown>,
): WebhookEventPayload {
  return {
    id: eventId,
    type: eventType,
    version,
    created_at: createdAt.toISOString(),
    data,
  };
}
