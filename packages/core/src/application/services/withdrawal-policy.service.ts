import { InvalidWithdrawalAmountError } from "../../domain/errors/invalid-withdrawal-amount.error";
import { WithdrawalLimitExceededError } from "../../domain/errors/withdrawal-limit-exceeded.error";

export interface WithdrawalPolicyLimits {
  feeInCents: number;
  minAmountInCents: number;
  maxAmountInCents: number;
  dailyAmountLimitInCents: number;
  dailyCountLimit: number;
}

export interface WithdrawalPolicyValidationInput {
  amountInCents: number;
  dailyAmountAlreadyRequested: number;
  dailyCountAlreadyRequested: number;
}

export class WithdrawalPolicy {
  static readonly defaults: WithdrawalPolicyLimits = {
    feeInCents: 199,
    minAmountInCents: 1000,
    maxAmountInCents: 500000,
    dailyAmountLimitInCents: 1000000,
    dailyCountLimit: 10,
  };

  constructor(private readonly limits = WithdrawalPolicy.defaults) {}

  calculate(amountInCents: number): {
    feeInCents: number;
    netAmountInCents: number;
  } {
    this.validateAmount(amountInCents);

    return {
      feeInCents: this.limits.feeInCents,
      netAmountInCents: amountInCents - this.limits.feeInCents,
    };
  }

  validate(input: WithdrawalPolicyValidationInput): void {
    this.validateAmount(input.amountInCents);

    if (
      input.dailyAmountAlreadyRequested + input.amountInCents >
      this.limits.dailyAmountLimitInCents
    ) {
      throw new WithdrawalLimitExceededError(
        `Daily withdrawal amount limit exceeded (${this.limits.dailyAmountLimitInCents} cents)`,
      );
    }

    if (input.dailyCountAlreadyRequested + 1 > this.limits.dailyCountLimit) {
      throw new WithdrawalLimitExceededError(
        `Daily withdrawal count limit exceeded (${this.limits.dailyCountLimit})`,
      );
    }
  }

  private validateAmount(amountInCents: number): void {
    if (!Number.isInteger(amountInCents)) {
      throw new InvalidWithdrawalAmountError(
        "Withdrawal amount must be an integer in cents",
      );
    }

    if (amountInCents < this.limits.minAmountInCents) {
      throw new InvalidWithdrawalAmountError(
        `Withdrawal amount must be at least ${this.limits.minAmountInCents} cents`,
      );
    }

    if (amountInCents > this.limits.maxAmountInCents) {
      throw new InvalidWithdrawalAmountError(
        `Withdrawal amount cannot exceed ${this.limits.maxAmountInCents} cents`,
      );
    }

    if (amountInCents <= this.limits.feeInCents) {
      throw new InvalidWithdrawalAmountError(
        "Withdrawal amount must be greater than the withdrawal fee",
      );
    }
  }
}
