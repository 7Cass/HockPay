import { DomainError } from './domain-error';

/**
 * Error thrown when trying to release a payment that is not confirmed.
 */
export class PaymentNotConfirmedError extends DomainError {
  constructor(paymentId: string, currentStatus: string) {
    super(
      `Payment ${paymentId} is not confirmed. Current status: ${currentStatus}`,
      'PAYMENT_NOT_CONFIRMED',
    );
    this.name = 'PaymentNotConfirmedError';
  }
}
