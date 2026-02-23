import { DomainError } from './domain-error';

/**
 * Error thrown when an API Key has an invalid format.
 */
export class InvalidApiKeyFormatError extends DomainError {
  constructor(key: string) {
    super(`Invalid API Key format: ${key}`, 'INVALID_API_KEY_FORMAT');
  }
}
