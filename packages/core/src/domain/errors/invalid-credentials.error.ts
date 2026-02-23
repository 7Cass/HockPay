import { DomainError } from './domain-error';

/**
 * Error thrown when login credentials are invalid.
 */
export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS');
  }
}
