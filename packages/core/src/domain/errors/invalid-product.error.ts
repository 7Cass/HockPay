import { DomainError } from "./domain-error";

export class InvalidProductError extends DomainError {
  constructor(message: string) {
    super(message, "INVALID_PRODUCT");
  }
}
