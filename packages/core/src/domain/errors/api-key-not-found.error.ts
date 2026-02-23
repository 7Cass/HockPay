import { DomainError } from './domain-error';

/**
 * Error thrown when an API Key is not found.
 */
export class ApiKeyNotFoundError extends DomainError {
  constructor(id: string) {
    super(`API Key not found: ${id}`, 'API_KEY_NOT_FOUND');
  }
}
