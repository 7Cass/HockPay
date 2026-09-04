import { EVENT_CATALOG, PublicEventType } from './event-catalog';

/**
 * Eventos que um lojista pode assinar num webhook.
 *
 * Derivado do catalogo em vez de mantido a mao: antes desta lista e do
 * catalogo serem a mesma coisa, um tipo novo entrava no sistema e ficava
 * invisivel para quem quisesse assina-lo.
 */
export type WebhookEventType = {
  [K in PublicEventType]: (typeof EVENT_CATALOG)[K]['delivery'] extends 'subscribable' ? K : never;
}[PublicEventType];

export const ALLOWED_WEBHOOK_EVENTS: readonly WebhookEventType[] = Object.entries(EVENT_CATALOG)
  .filter(([, definition]) => definition.delivery === 'subscribable')
  .map(([eventType]) => eventType as WebhookEventType);

/**
 * Check if an event is valid.
 */
export function isValidWebhookEvent(event: string): event is WebhookEventType {
  return (ALLOWED_WEBHOOK_EVENTS as readonly string[]).includes(event);
}

/**
 * Get all invalid events from a list.
 */
export function getInvalidEvents(events: string[]): string[] {
  return events.filter((event) => !isValidWebhookEvent(event));
}
