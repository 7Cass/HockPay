import { DomainError } from './domain-error';

/**
 * Error thrown when a customer is not found.
 * HTTP Status: 404 Not Found
 */
export class CustomerNotFoundError extends DomainError {
  public readonly externalId: string;

  constructor(externalId: string) {
    super(
      `Customer not found with externalId: ${externalId}`,
      'CUSTOMER_NOT_FOUND',
    );
    this.externalId = externalId;
  }
}
