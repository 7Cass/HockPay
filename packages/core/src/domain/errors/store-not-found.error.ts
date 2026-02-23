import { DomainError } from './domain-error';

/**
 * Error thrown when a store is not found.
 */
export class StoreNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Store not found: ${id}`, 'STORE_NOT_FOUND');
  }
}
