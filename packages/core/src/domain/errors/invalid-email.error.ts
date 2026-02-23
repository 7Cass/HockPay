import { DomainError } from './domain-error';

/**
 * Error thrown when an email address is invalid.
 */
export class InvalidEmailError extends DomainError {
  constructor(email: string) {
    super(`Invalid email address: ${email}`, 'INVALID_EMAIL');
  }
}
