import { DomainError } from './domain-error';

/**
 * Error thrown when attempting to create a merchant with an email or document that already exists.
 */
export class MerchantAlreadyExistsError extends DomainError {
  constructor() {
    super('Merchant with this email or document already exists', 'MERCHANT_ALREADY_EXISTS');
  }
}
