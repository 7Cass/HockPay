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
  created_at: string; // ISO string
  data: Record<string, unknown>;
}

/**
 * Build webhook event payload with envelope format.
 *
 * @param eventId - OutboxEvent ID (same ID used for retries)
 * @param eventType - Event type (ex: "payment.confirmed")
 * @param createdAt - Event creation timestamp
 * @param data - Full sanitized event object
 * @returns Webhook event payload envelope
 */
export function buildWebhookEventPayload(
  eventId: string,
  eventType: string,
  createdAt: Date,
  data: Record<string, unknown>,
): WebhookEventPayload {
  return {
    id: eventId,
    type: eventType,
    created_at: createdAt.toISOString(),
    data,
  };
}
