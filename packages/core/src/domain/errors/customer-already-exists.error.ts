import { DomainError } from './domain-error';

/**
 * Error thrown when trying to create a customer with an externalId that already exists.
 * HTTP Status: 409 Conflict
 */
export class CustomerAlreadyExistsError extends DomainError {
  public readonly internalId: string;

  constructor(internalId: string) {
    super('Customer already exists with this externalId', 'CUSTOMER_ALREADY_EXISTS');
    this.internalId = internalId;
  }
}
