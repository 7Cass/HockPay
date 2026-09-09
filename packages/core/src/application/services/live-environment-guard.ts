import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';
import { StoreLiveNotEnabledError } from '../../domain/errors/store-live-not-enabled.error';
import { Store } from '../../domain/entities/store.entity';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * The single rule that gates LIVE for caller-initiated operations: the desk
 * must have opened LIVE for this store.
 *
 * Applies to creating a charge and to simulating one. It deliberately does not
 * apply to the system's own paths -- the settlement job and the expiration
 * queue -- which move a payment that was already legitimately created.
 * Blocking those would strand LIVE money in `pending` forever, which is worse
 * than anything suspension is trying to prevent.
 */
export function assertLiveEnvironmentEnabled(store: Store, environment: Environment): void {
  if (environment === Environment.LIVE && !store.isLiveEnabled()) {
    throw new StoreLiveNotEnabledError(store.id);
  }
}

/**
 * The whole rule for a caller-initiated simulation, in one place.
 *
 * Two things have to hold, and they are different things:
 *
 * 1. The caller's environment must be the aggregate's. A TEST key confirming a
 *    LIVE payment is a mismatched caller -- `LIVE_ENVIRONMENT_NOT_ALLOWED`,
 *    the meaning that code keeps.
 * 2. If the aggregate is LIVE, the desk must have the store enabled --
 *    `STORE_LIVE_NOT_ENABLED`. This one reads the store, which is one extra
 *    read inside the transaction the caller already opened. That is the cost
 *    of the enablement being a fact of the store and not of the payment: a
 *    payment created while LIVE was open stops being simulatable the moment
 *    the desk closes it.
 *
 * `callerEnvironment` is required. The system's own paths (settlement job,
 * expiration queue) do not call this at all -- they are marked
 * `systemInitiated` and skip the gate, because moving a payment the store
 * legitimately created is the clock doing its job, not a caller operating in
 * LIVE. Blocking them would strand LIVE money in `pending` forever.
 */
export async function assertLiveSimulationAllowed(
  repos: { storeRepository: { findById(id: string): Promise<Store | null> } },
  storeId: string,
  aggregateEnvironment: Environment | undefined,
  callerEnvironment: Environment | undefined,
): Promise<void> {
  // Fail closed: a caller-initiated path that forgot to say who it is does not
  // get the benefit of the doubt.
  if (!callerEnvironment || callerEnvironment !== aggregateEnvironment) {
    throw new LiveEnvironmentNotAllowedError();
  }

  if (aggregateEnvironment !== Environment.LIVE) {
    return;
  }

  const store = await repos.storeRepository.findById(storeId);

  if (!store || !store.isLiveEnabled()) {
    throw new StoreLiveNotEnabledError(storeId);
  }
}

/**
 * A TEST caller may not mutate a LIVE aggregate.
 *
 * Used by the paths that have no LIVE version of their own (refund, cancelling
 * a payment link): they are JWT-only, the dashboard session is TEST, and this
 * is what keeps a TEST session from reaching into LIVE.
 */
export function assertCallerCanMutateEnvironment(
  aggregateEnvironment: Environment | undefined,
  callerEnvironment: Environment = Environment.TEST,
): void {
  if (aggregateEnvironment === Environment.LIVE && callerEnvironment !== Environment.LIVE) {
    throw new LiveEnvironmentNotAllowedError();
  }
}

/**
 * The same rule as `assertLiveEnvironmentEnabled`, for a caller that does not
 * already hold the store.
 *
 * Money leaving the store -- a withdrawal, a refund -- is gated by the same
 * enablement as money entering it: a store the desk closed does not move money
 * on its own. The read sits behind the LIVE check, because TEST should not pay
 * for a rule that only exists in LIVE.
 *
 * It reads the store **at the moment of the call**, and that is the whole
 * point: nothing revokes an access token in flight, so a suspension only holds
 * if the path that moves money asks the store rather than trusting the token.
 * That gap is exactly why a suspended store kept withdrawing for up to the
 * access token's TTL while its charges were already being refused.
 */
export async function assertLiveEnvironmentEnabledById(
  repos: { storeRepository: { findById(id: string): Promise<Store | null> } },
  storeId: string,
  environment: Environment | undefined,
): Promise<void> {
  if (environment !== Environment.LIVE) {
    return;
  }

  const store = await repos.storeRepository.findById(storeId);

  if (!store || !store.isLiveEnabled()) {
    throw new StoreLiveNotEnabledError(storeId);
  }
}
