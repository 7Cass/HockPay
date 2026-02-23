import { DomainError } from './domain-error';

/**
 * Error thrown when attempting to operate on an expired payment.
 */
export class PaymentExpiredError extends DomainError {
  constructor(paymentId: string) {
    super(
      `Payment ${paymentId} has expired and cannot be modified`,
      'PAYMENT_EXPIRED'
    );
  }
}
