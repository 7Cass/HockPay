import { DomainError } from './domain-error';

/**
 * Error thrown when trying to use a document that is already associated with another customer.
 * HTTP Status: 422 Unprocessable Entity
 */
export class DocumentAlreadyInUseError extends DomainError {
  public readonly conflictingExternalId: string;

  constructor(conflictingExternalId: string) {
    super('Document is already associated with another customer', 'DOCUMENT_ALREADY_IN_USE');
    this.conflictingExternalId = conflictingExternalId;
  }
}
