import { DomainError } from "./domain-error";

export class InvalidWithdrawalStatusError extends DomainError {
  constructor(message: string) {
    super(message, "INVALID_WITHDRAWAL_STATUS");
    this.name = "InvalidWithdrawalStatusError";
  }
}
