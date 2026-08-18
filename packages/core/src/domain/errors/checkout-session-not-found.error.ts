import { DomainError } from "./domain-error";

export class CheckoutSessionNotFoundError extends DomainError {
  constructor(token?: string) {
    super(
      token
        ? `Checkout session not found or invalid token: ${token}`
        : "Checkout session not found or invalid token",
      "CHECKOUT_SESSION_NOT_FOUND",
    );
  }
}
