import { DomainError } from './domain-error';

/**
 * Error thrown when a payment is not found.
 */
export class PaymentNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Payment not found: ${identifier}`, 'PAYMENT_NOT_FOUND');
  }
}
