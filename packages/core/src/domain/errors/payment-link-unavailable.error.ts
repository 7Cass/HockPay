import { DomainError } from './domain-error';

export class PaymentLinkUnavailableError extends DomainError {
  constructor(message: string) {
    super(message, 'PAYMENT_LINK_UNAVAILABLE');
  }
}
