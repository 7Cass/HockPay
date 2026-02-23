import { PaymentObject } from '../../domain/entities/payment.entity';

/**
 * Webhook Payload Builder
 *
 * Helper functions to build webhook payloads for payment events.
 * Follows Stripe-like envelope format with event metadata and full object in data.
 */

/**
 * Webhook event payload envelope (Stripe-like format).
 */
export interface WebhookEventPayload {
  id: string; // OutboxEvent ID
  type: string; // eventType (ex: "payment.confirmed")
  created_at: string; // ISO string
  data: PaymentObject; // Payment completo
}

/**
 * Build webhook event payload with envelope format.
 *
 * @param eventId - OutboxEvent ID (same ID used for retries)
 * @param eventType - Event type (ex: "payment.confirmed")
 * @param createdAt - Event creation timestamp
 * @param paymentData - Full payment object
 * @returns Webhook event payload envelope
 */
export function buildWebhookEventPayload(
  eventId: string,
  eventType: string,
  createdAt: Date,
  paymentData: PaymentObject,
): WebhookEventPayload {
  return {
    id: eventId,
    type: eventType,
    created_at: createdAt.toISOString(),
    data: paymentData,
  };
}
