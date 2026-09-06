import { DomainError } from './domain-error';

/**
 * Error thrown when a caller tries to operate in LIVE on a store whose LIVE
 * enablement is not APPROVED.
 *
 * This is a fact of the domain, not a failure: the desk has not opened LIVE for
 * this store, or has revoked it. TEST is unaffected in every state.
 */
export class StoreLiveNotEnabledError extends DomainError {
  constructor(id: string) {
    super(`Store is not enabled for LIVE: ${id}`, 'STORE_LIVE_NOT_ENABLED');
  }
}
