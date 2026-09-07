import { DomainError } from './domain-error';
import { StoreLiveStatus } from '../value-objects/store-live-status.vo';

/**
 * Error thrown when a LIVE enablement transition is not one of the allowed
 * moves.
 *
 * In particular: the desk does not approve a store that never asked, and a
 * merchant does not leave SUSPENDED on their own -- reinstating is a decision
 * of the desk, with a reason.
 */
export class InvalidStoreLiveStatusTransitionError extends DomainError {
  constructor(from: StoreLiveStatus, to: StoreLiveStatus) {
    super(
      `Cannot move store live status from ${from} to ${to}`,
      'INVALID_STORE_LIVE_STATUS_TRANSITION',
    );
  }
}
