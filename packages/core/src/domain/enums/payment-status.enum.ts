/**
 * Enum: PaymentStatus
 *
 * Represents the possible states of a payment in the system.
 *
 * Status Flow:
 * PENDING → CONFIRMED → RELEASED → REFUNDED (terminal)
 *        ↘ EXPIRED (terminal)
 *        ↘ FAILED (terminal)
 */
export enum PaymentStatus {
  /**
   * Payment has been created but not yet paid.
   * Can transition to: CONFIRMED, EXPIRED, FAILED
   */
  PENDING = 'PENDING',

  /**
   * Payment has been confirmed (customer paid).
   * Can transition to: RELEASED, REFUNDED
   */
  CONFIRMED = 'CONFIRMED',

  /**
   * Payment has been released to the merchant's account.
   * Can transition to: REFUNDED
   */
  RELEASED = 'RELEASED',

  /**
   * Payment has expired before being paid.
   * Terminal state - no further transitions.
   */
  EXPIRED = 'EXPIRED',

  /**
   * Payment has failed.
   * Terminal state - no further transitions.
   */
  FAILED = 'FAILED',

  /**
   * Payment has been refunded.
   * Terminal state - no further transitions.
   */
  REFUNDED = 'REFUNDED',
}

/**
 * Map of valid status transitions.
 * Used to validate business rules for state changes.
 */
export const VALID_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.CONFIRMED,
    PaymentStatus.EXPIRED,
    PaymentStatus.FAILED,
  ],
  [PaymentStatus.CONFIRMED]: [PaymentStatus.RELEASED, PaymentStatus.REFUNDED],
  [PaymentStatus.RELEASED]: [PaymentStatus.REFUNDED],
  [PaymentStatus.EXPIRED]: [],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.REFUNDED]: [],
};

/**
 * Set of terminal statuses that cannot transition to any other status.
 */
export const TERMINAL_STATUSES: Set<PaymentStatus> = new Set([
  PaymentStatus.EXPIRED,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
]);
