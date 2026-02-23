/**
 * Allowed webhook event types.
 */
export const ALLOWED_WEBHOOK_EVENTS = [
  'payment.created',
  'payment.confirmed',
  'payment.failed',
  'payment.expired',
  'payment.released',
] as const;

/**
 * Webhook event type.
 */
export type WebhookEventType = (typeof ALLOWED_WEBHOOK_EVENTS)[number];

/**
 * Check if an event is valid.
 */
export function isValidWebhookEvent(event: string): event is WebhookEventType {
  return ALLOWED_WEBHOOK_EVENTS.includes(event as WebhookEventType);
}

/**
 * Get all invalid events from a list.
 */
export function getInvalidEvents(events: string[]): string[] {
  return events.filter((event) => !isValidWebhookEvent(event));
}
