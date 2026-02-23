import { DomainError } from './domain-error';

/**
 * Error thrown when a merchant attempts an operation that requires a store,
 * but no store is currently selected.
 */
export class NoCurrentStoreError extends DomainError {
  constructor() {
    super(
      'No store selected. Please select a store before performing this action.',
      'NO_CURRENT_STORE',
    );
  }
}
