import { DomainError } from "./domain-error";

export class CheckoutSessionExpiredError extends DomainError {
  constructor(token?: string) {
    super(
      token
        ? `Checkout session has expired: ${token}`
        : "Checkout session has expired",
      "CHECKOUT_SESSION_EXPIRED",
    );
  }
}
