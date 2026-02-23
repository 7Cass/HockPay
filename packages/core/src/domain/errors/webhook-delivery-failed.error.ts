import { DomainError } from './domain-error';

/**
 * Error thrown when webhook delivery fails after max retries.
 */
export class WebhookDeliveryFailedError extends DomainError {
  constructor(
    public readonly eventId: string,
    public readonly attemptCount: number,
    public readonly lastError: string,
  ) {
    super(
      `Webhook delivery failed after ${attemptCount} attempts for event ${eventId}: ${lastError}`,
      'WEBHOOK_DELIVERY_FAILED',
    );
    this.name = 'WebhookDeliveryFailedError';
  }
}
