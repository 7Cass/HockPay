import { DomainError } from './domain-error';

export class PaymentLinkNotFoundError extends DomainError {
  constructor(idOrToken: string) {
    super(`Payment link not found: ${idOrToken}`, 'PAYMENT_LINK_NOT_FOUND');
  }
}
