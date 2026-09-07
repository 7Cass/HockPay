import { DomainError } from './domain-error';

/**
 * Error thrown when the desk tries to set a commercial condition outside the
 * range the simulator accepts.
 *
 * The bounds are the simulator's, not the market's. They exist so a typo at
 * the desk does not become a 150% fee on every future charge of a store --
 * which is the only damage this power can cause.
 */
export class InvalidCommercialTermsError extends DomainError {
  constructor(field: string, reason: string) {
    super(`Invalid commercial terms: ${field} ${reason}`, 'INVALID_COMMERCIAL_TERMS');
  }
}
