import { DomainError } from './domain-error';

/**
 * Error thrown when trying to authenticate with an inactive merchant account.
 */
export class MerchantInactiveError extends DomainError {
  constructor() {
    super('Merchant account is inactive', 'MERCHANT_INACTIVE');
  }
}
