import { Merchant } from '../../domain/entities/merchant.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { IStoreRepository } from '../../domain/repositories/store.repository.interface';

/**
 * The environment a merchant session is entitled to *right now*, given what the
 * desk has decided about the merchant's current store.
 *
 * LIVE enablement is a fact of the store, and the desk can revoke it at any
 * moment. Every path that reissues a session without the merchant having asked
 * for anything -- login, refresh -- has to reconfer it, or a stored `LIVE`
 * would outlive the approval that justified it.
 *
 * It **degrades instead of failing**. A merchant whose store was just suspended
 * keeps getting in; what they lose is LIVE, which is the point. Locking them
 * out of their own session is worse than the thing suspension is trying to
 * prevent, and Settings is where they read the reason -- the same call the
 * settlement job's exemption made in the LIVE onboarding slice.
 *
 * The caller persists the merchant when this returns something different from
 * what it was handed; the demotion is not allowed to be forgotten between
 * refreshes.
 */
export async function resolveSessionEnvironment(
  storeRepository: Pick<IStoreRepository, 'findById'>,
  merchant: Merchant,
): Promise<Environment> {
  if (merchant.currentEnvironment !== Environment.LIVE) {
    return Environment.TEST;
  }

  const storeId = merchant.currentStoreId;
  if (!storeId) {
    return Environment.TEST;
  }

  const store = await storeRepository.findById(storeId);

  return store?.isLiveEnabled() ? Environment.LIVE : Environment.TEST;
}
