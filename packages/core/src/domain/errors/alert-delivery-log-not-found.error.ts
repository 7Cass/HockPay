import { DomainError } from './domain-error';

export class AlertDeliveryLogNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Alert delivery log not found: ${id}`, 'ALERT_DELIVERY_LOG_NOT_FOUND');
  }
}
