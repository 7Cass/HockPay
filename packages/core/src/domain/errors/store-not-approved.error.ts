import { DomainError } from './domain-error';

/**
 * Error thrown when attempting to use a store that is not approved.
 */
export class StoreNotApprovedError extends DomainError {
  constructor(id: string) {
    super(`Store is not approved: ${id}`, 'STORE_NOT_APPROVED');
  }
}
