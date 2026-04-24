import { DomainError } from './domain-error';

export class InvalidAlertEventsError extends DomainError {
  constructor(events: string[]) {
    super(`Invalid alert events: ${events.join(', ')}`, 'INVALID_ALERT_EVENTS');
  }
}
