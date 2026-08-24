import { DomainError } from './domain-error';

/**
 * Error thrown when a webhook config is not found.
 */
export class WebhookConfigNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Webhook config not found: ${id}`, 'WEBHOOK_CONFIG_NOT_FOUND');
  }
}
