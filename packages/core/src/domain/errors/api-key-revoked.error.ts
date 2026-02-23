import { DomainError } from './domain-error';

/**
 * Error thrown when attempting to use a revoked API Key.
 */
export class ApiKeyRevokedError extends DomainError {
  constructor(id: string) {
    super(`API Key has been revoked: ${id}`, 'API_KEY_REVOKED');
  }
}
