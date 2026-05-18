import { DomainError } from "./domain-error";

export class BankAccountNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Bank account not found: ${identifier}`, "BANK_ACCOUNT_NOT_FOUND");
    this.name = "BankAccountNotFoundError";
  }
}
