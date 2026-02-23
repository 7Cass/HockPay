import { DomainError } from './domain-error';

/**
 * Error thrown when invalid webhook events are provided.
 */
export class InvalidWebhookEventsError extends DomainError {
  constructor(invalidEvents: string[]) {
    super(
      `Invalid webhook events: ${invalidEvents.join(', ')}`,
      'INVALID_WEBHOOK_EVENTS',
    );
  }
}
