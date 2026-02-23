import { DomainError } from './domain-error';

/**
 * Error thrown when a refresh token is invalid.
 */
export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }
}
