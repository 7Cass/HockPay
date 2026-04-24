import { DomainError } from './domain-error';

export class AlertConfigNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Alert config not found: ${id}`, 'ALERT_CONFIG_NOT_FOUND');
  }
}
