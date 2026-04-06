import { DomainError } from "./domain-error";

export class ReceiptNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Receipt not found: ${identifier}`, "RECEIPT_NOT_FOUND");
  }
}
