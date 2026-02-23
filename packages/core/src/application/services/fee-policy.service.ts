/**
 * Input for fee calculation.
 */
export interface FeeCalculationInput {
  /**
   * Payment amount in cents.
   */
  amountInCents: number;

  /**
   * Fee percentage (e.g., 1.5 for 1.5%).
   */
  feePercent: number;

  /**
   * Fixed fee in cents.
   */
  feeFixed: number;
}

/**
 * Result of fee calculation.
 */
export interface FeeCalculationResult {
  /**
   * Calculated fee in cents (percentage + fixed).
   */
  feeInCents: number;

  /**
   * Net amount after fees (amount - fee).
   */
  netAmountInCents: number;

  /**
   * Percentage portion of the fee.
   */
  percentFeeInCents: number;

  /**
   * Fixed portion of the fee.
   */
  fixedFeeInCents: number;
}

/**
 * Service: FeePolicy
 *
 * Calculates fees for payments based on store configuration.
 * Uses percentage + fixed fee model (e.g., 1.5% + R$0.15).
 */
export class FeePolicy {
  /**
   * Calculate fees for a payment.
   *
   * The fee is calculated as:
   * - percentFee = round(amount * feePercent / 100)
   * - fixedFee = feeFixed
   * - totalFee = percentFee + fixedFee
   * - netAmount = amount - totalFee
   *
   * Rounding follows Brazilian banking standards (round to nearest cent).
   */
  calculate(input: FeeCalculationInput): FeeCalculationResult {
    const { amountInCents, feePercent, feeFixed } = input;

    // Calculate percentage fee (rounded to nearest cent)
    const percentFeeInCents = Math.round((amountInCents * feePercent) / 100);

    // Fixed fee is already in cents
    const fixedFeeInCents = feeFixed;

    // Total fee
    const feeInCents = percentFeeInCents + fixedFeeInCents;

    // Net amount after fees
    const netAmountInCents = amountInCents - feeInCents;

    return {
      feeInCents,
      netAmountInCents,
      percentFeeInCents,
      fixedFeeInCents,
    };
  }
}
