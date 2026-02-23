import { DomainError } from './domain-error';

/**
 * Error thrown when an account is not found.
 */
export class AccountNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Account not found: ${identifier}`, 'ACCOUNT_NOT_FOUND');
    this.name = 'AccountNotFoundError';
  }
}
