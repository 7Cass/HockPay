import { DomainError } from "./domain-error";

export class InvalidWithdrawalAmountError extends DomainError {
  constructor(message: string) {
    super(message, "INVALID_WITHDRAWAL_AMOUNT");
    this.name = "InvalidWithdrawalAmountError";
  }
}
