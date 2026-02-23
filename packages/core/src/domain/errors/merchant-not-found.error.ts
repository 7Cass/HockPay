import { DomainError } from './domain-error';

/**
 * Error thrown when a merchant is not found.
 */
export class MerchantNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Merchant not found: ${id}`, 'MERCHANT_NOT_FOUND');
  }
}
