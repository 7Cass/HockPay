import { InvalidPaymentAmountError } from "../../domain/errors/invalid-payment-amount.error";

export interface FeeCalculationInput {
  amountInCents: number;
  feePercent: number;
  feeFixed: number;
}

export interface FeeCalculationResult {
  feeInCents: number;
  netAmountInCents: number;
  percentFeeInCents: number;
  fixedFeeInCents: number;
}

export class FeePolicy {
  calculate(input: FeeCalculationInput): FeeCalculationResult {
    const { amountInCents, feePercent, feeFixed } = input;

    if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
      throw new InvalidPaymentAmountError(
        "Amount must be a positive integer in cents",
        amountInCents,
      );
    }

    const percentFeeInCents = Math.round((amountInCents * feePercent) / 100);
    const fixedFeeInCents = feeFixed;
    const feeInCents = percentFeeInCents + fixedFeeInCents;

    if (feeInCents >= amountInCents) {
      throw new InvalidPaymentAmountError(
        "Fee must be less than the payment amount",
        amountInCents,
      );
    }

    return {
      feeInCents,
      netAmountInCents: amountInCents - feeInCents,
      percentFeeInCents,
      fixedFeeInCents,
    };
  }
}
