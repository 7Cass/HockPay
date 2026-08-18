import { DomainError } from "./domain-error";

export class CheckoutSessionInvalidStatusError extends DomainError {
  constructor(status: string) {
    super(
      `Checkout session cannot be fulfilled because its status is ${status}`,
      "CHECKOUT_SESSION_INVALID_STATUS",
    );
  }
}
