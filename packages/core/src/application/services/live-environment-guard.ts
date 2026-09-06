import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';
import { StoreLiveNotEnabledError } from '../../domain/errors/store-live-not-enabled.error';
import { Store } from '../../domain/entities/store.entity';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * Refuse LIVE outright.
 *
 * After the LIVE onboarding slice this no longer means "LIVE is never allowed
 * here" in general -- it means "this path has no LIVE version at all", which is
 * true of withdrawals and refunds: they are JWT-only, and the dashboard session
 * is TEST. Paths that do have a LIVE version use `assertLiveEnvironmentEnabled`
 * instead.
 */
export function assertNotLiveEnvironment(environment: Environment | undefined): void {
  if (environment === Environment.LIVE) {
    throw new LiveEnvironmentNotAllowedError();
  }
}

/**
 * The single rule that gates LIVE for caller-initiated operations: the desk
 * must have opened LIVE for this store.
 *
 * Applies to creating a charge and to simulating one. It deliberately does not
 * apply to the settlement job, which is the system clock moving `pending` to
 * `available` on a payment that was already confirmed -- blocking that would
 * strand LIVE money in `pending` forever.
 */
export function assertLiveEnvironmentEnabled(store: Store, environment: Environment): void {
  if (environment === Environment.LIVE && !store.isLiveEnabled()) {
    throw new StoreLiveNotEnabledError(store.id);
  }
}

export function assertCallerCanMutateEnvironment(
  aggregateEnvironment: Environment | undefined,
  callerEnvironment: Environment = Environment.TEST,
): void {
  if (aggregateEnvironment === Environment.LIVE && callerEnvironment !== Environment.LIVE) {
    throw new LiveEnvironmentNotAllowedError();
  }
}
