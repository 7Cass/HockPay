import { ALLOWED_WEBHOOK_EVENTS, WebhookEventType } from './webhook-events';

/**
 * Alert events currently mirror payment webhook events.
 * Keep this constant separate so future internal-only alert events do not
 * become part of the public webhook contract by accident.
 */
export const ALLOWED_ALERT_EVENTS: readonly WebhookEventType[] = [...ALLOWED_WEBHOOK_EVENTS];

export type AlertEventType = WebhookEventType;

export function isValidAlertEvent(event: string): event is AlertEventType {
  return (ALLOWED_ALERT_EVENTS as readonly string[]).includes(event);
}

export function getInvalidAlertEvents(events: string[]): string[] {
  return events.filter((event) => !isValidAlertEvent(event));
}
