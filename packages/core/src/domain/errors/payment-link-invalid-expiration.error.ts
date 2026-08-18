import { DomainError } from "./domain-error";

export class PaymentLinkInvalidExpirationError extends DomainError {
  constructor() {
    super(
      "Payment link expiration must be a future date",
      "PAYMENT_LINK_INVALID_EXPIRATION",
    );
  }
}
