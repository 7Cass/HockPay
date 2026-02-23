import { DomainError } from './domain-error';

/**
 * Error thrown when a token has expired.
 */
export class TokenExpiredError extends DomainError {
  constructor() {
    super('Token has expired', 'TOKEN_EXPIRED');
  }
}
