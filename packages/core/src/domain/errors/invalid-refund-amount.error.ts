import { DomainError } from './domain-error';

export class InvalidRefundAmountError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_REFUND_AMOUNT');
  }
}
