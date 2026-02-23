import { DomainError } from './domain-error';

/**
 * Error thrown when a document (CPF/CNPJ) is invalid.
 */
export class InvalidDocumentError extends DomainError {
  constructor(document: string) {
    super(`Invalid document: ${document}`, 'INVALID_DOCUMENT');
  }
}
