import { DomainError } from './domain-error';

/**
 * Error thrown when an API Key has an invalid format.
 */
export class InvalidApiKeyFormatError extends DomainError {
  constructor() {
    super('Invalid API Key format', 'INVALID_API_KEY_FORMAT');
  }
}
