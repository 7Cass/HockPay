import { DomainError } from './domain-error';

/**
 * Error thrown when trying to simulate a payment in LIVE environment.
 *
 * Simulation is only allowed for payments created with TEST API keys.
 */
export class LiveEnvironmentNotAllowedError extends DomainError {
  constructor() {
    super(
      'Simulation is not allowed for payments in LIVE environment',
      'LIVE_ENVIRONMENT_NOT_ALLOWED',
    );
  }
}
