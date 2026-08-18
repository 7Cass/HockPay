import { DomainError } from "./domain-error";

export class PaymentLinkCannotBeCancelledError extends DomainError {
  constructor() {
    super(
      "Payment link cannot be cancelled after payment is paid",
      "PAYMENT_LINK_CANNOT_BE_CANCELLED",
    );
  }
}
