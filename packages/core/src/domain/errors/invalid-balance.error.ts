import { DomainError } from "./domain-error";

/**
 * Thrown when an account operation exceeds a bucket or receives a negative amount.
 */
export class InvalidBalanceError extends DomainError {
  constructor(message: string) {
    super(message, "INVALID_BALANCE");
  }
}
