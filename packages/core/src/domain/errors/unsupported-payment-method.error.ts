import { DomainError } from './domain-error';

export class UnsupportedPaymentMethodError extends DomainError {
  constructor(method: string) {
    super(
      `Payment method ${method} is not processed. Only PIX is accepted.`,
      'UNSUPPORTED_PAYMENT_METHOD',
    );
  }
}
