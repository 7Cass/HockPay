import { DomainError } from "./domain-error";

export class UnauthorizedBankAccountAccessError extends DomainError {
  constructor() {
    super(
      "Unauthorized access to bank account",
      "UNAUTHORIZED_BANK_ACCOUNT_ACCESS",
    );
  }
}
