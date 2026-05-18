import { DomainError } from "./domain-error";

export class WithdrawalLimitExceededError extends DomainError {
  constructor(message: string) {
    super(message, "WITHDRAWAL_LIMIT_EXCEEDED");
    this.name = "WithdrawalLimitExceededError";
  }
}
