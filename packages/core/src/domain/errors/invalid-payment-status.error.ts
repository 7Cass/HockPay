import { DomainError } from './domain-error';
import { PaymentStatus } from '../enums/payment-status.enum';

/**
 * Error thrown when an invalid payment status transition is attempted.
 */
export class InvalidPaymentStatusError extends DomainError {
  constructor(currentStatus: PaymentStatus, targetStatus: PaymentStatus) {
    super(
      `Cannot transition payment from ${currentStatus} to ${targetStatus}`,
      'INVALID_PAYMENT_STATUS_TRANSITION',
    );
  }
}
