import { ALLOWED_WEBHOOK_EVENTS } from './webhook-events';

/**
 * Alert events currently mirror payment webhook events.
 * Keep this constant separate so future internal-only alert events do not
 * become part of the public webhook contract by accident.
 */
export const ALLOWED_ALERT_EVENTS = [...ALLOWED_WEBHOOK_EVENTS] as const;

export type AlertEventType = (typeof ALLOWED_ALERT_EVENTS)[number];

export function isValidAlertEvent(event: string): event is AlertEventType {
  return ALLOWED_ALERT_EVENTS.includes(event as AlertEventType);
}

export function getInvalidAlertEvents(events: string[]): string[] {
  return events.filter((event) => !isValidAlertEvent(event));
}
