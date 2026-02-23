import { DomainError } from './domain-error';

/**
 * Error thrown when a refresh token has been revoked.
 */
export class RefreshTokenRevokedError extends DomainError {
  constructor() {
    super('Refresh token has been revoked', 'REFRESH_TOKEN_REVOKED');
  }
}
