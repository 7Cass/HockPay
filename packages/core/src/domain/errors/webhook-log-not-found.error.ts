import { DomainError } from './domain-error';

/**
 * Error thrown when a webhook delivery log is not found.
 */
export class WebhookLogNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Webhook log not found: ${id}`, 'WEBHOOK_LOG_NOT_FOUND');
  }
}
