import { DomainError } from './domain-error';

/**
 * Error thrown when attempting to create a payment with an externalId
 * that already exists for the store.
 */
export class ExternalIdAlreadyExistsError extends DomainError {
  constructor(externalId: string) {
    super(
      `A payment with externalId "${externalId}" already exists`,
      'EXTERNAL_ID_ALREADY_EXISTS'
    );
  }
}
