import { DomainError } from './domain-error';

export class InvalidAlertChannelError extends DomainError {
  constructor(channel: string) {
    super(`Invalid alert channel: ${channel}`, 'INVALID_ALERT_CHANNEL');
  }
}
