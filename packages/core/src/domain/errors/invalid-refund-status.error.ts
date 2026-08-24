import { DomainError } from './domain-error';

export class InvalidRefundStatusError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_REFUND_STATUS');
  }
}
