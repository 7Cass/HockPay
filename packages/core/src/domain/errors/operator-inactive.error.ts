import { DomainError } from './domain-error';

/**
 * Error thrown when an operator account exists but has been deactivated.
 */
export class OperatorInactiveError extends DomainError {
  constructor() {
    super('Operator account is inactive', 'OPERATOR_INACTIVE');
  }
}
