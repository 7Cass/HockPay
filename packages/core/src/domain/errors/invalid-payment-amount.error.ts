import { DomainError } from './domain-error';

/**
 * Error thrown when a payment amount is invalid.
 * This includes amounts that are zero, negative, or non-integer.
 */
export class InvalidPaymentAmountError extends DomainError {
  constructor(
    message: string = 'Invalid payment amount',
    public readonly amount?: number,
  ) {
    super(message, 'INVALID_PAYMENT_AMOUNT');
  }
}
