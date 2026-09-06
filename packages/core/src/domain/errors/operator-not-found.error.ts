import { DomainError } from './domain-error';

/**
 * Error thrown when an operator cannot be found.
 */
export class OperatorNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Operator ${id} not found`, 'OPERATOR_NOT_FOUND');
  }
}
