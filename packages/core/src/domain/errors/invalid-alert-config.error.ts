import { DomainError } from './domain-error';

export class InvalidAlertConfigError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_ALERT_CONFIG');
  }
}
