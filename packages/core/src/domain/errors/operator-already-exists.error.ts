import { DomainError } from './domain-error';

/**
 * Error thrown when provisioning an operator with an email already in use.
 */
export class OperatorAlreadyExistsError extends DomainError {
  constructor(email: string) {
    super(`Operator with email ${email} already exists`, 'OPERATOR_ALREADY_EXISTS');
  }
}
