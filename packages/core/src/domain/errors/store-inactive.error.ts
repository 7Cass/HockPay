import { DomainError } from './domain-error';

/**
 * Error thrown when attempting to use an inactive store.
 */
export class StoreInactiveError extends DomainError {
  constructor(id: string) {
    super(`Store is inactive: ${id}`, 'STORE_INACTIVE');
  }
}
