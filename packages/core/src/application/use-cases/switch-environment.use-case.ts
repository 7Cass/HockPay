import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { MerchantNotFoundError } from '../../domain/errors/merchant-not-found.error';
import { NoCurrentStoreError } from '../../domain/errors/no-current-store.error';
import { StoreLiveNotEnabledError } from '../../domain/errors/store-live-not-enabled.error';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { Environment } from '../../domain/value-objects/environment.vo';
import { IJwtServicePort } from '../ports/jwt-service.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';

/**
 * Input DTO for SwitchEnvironmentUseCase.
 */
export interface ISwitchEnvironmentInput {
  merchantId: string;
  environment: Environment;
}

/**
 * Output DTO for SwitchEnvironmentUseCase.
 */
export interface ISwitchEnvironmentOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  environment: Environment;
}

/**
 * Use Case: Switch Environment
 *
 * Moves the merchant's dashboard session between TEST and LIVE, in the order
 * `SwitchStoreUseCase` already established: validate, persist on the merchant,
 * revoke the old refresh token, reissue the pair.
 *
 * Two decisions this encodes:
 *
 * - **The gate is here, not on the screen.** Selecting LIVE requires the desk
 *   to have approved this store. A disabled option in a dropdown is a courtesy;
 *   this is the rule.
 * - **Revoking the old refresh token is not housekeeping.** It ends the old
 *   session's ability to *renew* itself: without it, a refresh token minted
 *   before the switch would keep hatching new tokens in a session the merchant
 *   already left.
 *
 * What this does **not** do, and what an earlier version of this comment
 * wrongly claimed it did: it does not kill the old **access** token. That one
 * is a JWT, so nothing revokes it in flight -- it stays valid, carrying the
 * previous `environment`, until it expires (15m). Verified against the running
 * API in `2026-09-08`: the old refresh is refused with 401, the old access
 * still reads the previous ledger.
 *
 * That window is a consequence of D1/D2 of the environment-selector PRD -- the
 * token is the copy, the merchant is the source, and the copy is only refreshed
 * where tokens are issued -- and not an oversight. It is tolerable here because
 * the cookie is replaced browser-wide on switch, so no legitimate client holds
 * the old token, and what a held one reads is the merchant's own ledger in the
 * environment they just left. Closing it means making the guard stateful, which
 * is a decision for whoever needs a *money* path to distrust the token; such a
 * path must re-read the store on the call, the way `CreatePaymentUseCase` does,
 * rather than lean on token revocation that does not exist.
 *
 * TEST is never refused, in any of the five enablement states. That is the
 * promise the LIVE onboarding slice made, and it is not renegotiated here.
 */
export class SwitchEnvironmentUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly jwtService: IJwtServicePort,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: ISwitchEnvironmentInput): Promise<ISwitchEnvironmentOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const merchant = await repos.merchantRepository.findByIdForUpdate(input.merchantId);

      if (!merchant) {
        throw new MerchantNotFoundError(input.merchantId);
      }

      // The environment decides which ledger the session reads, and a ledger
      // belongs to a store. Without one there is nothing to choose between.
      const storeId = merchant.currentStoreId;
      if (!storeId) {
        throw new NoCurrentStoreError();
      }

      const store = await repos.storeRepository.findById(storeId);
      if (!store) {
        throw new StoreNotFoundError(storeId);
      }

      if (input.environment === Environment.LIVE && !store.isLiveEnabled()) {
        throw new StoreLiveNotEnabledError(store.id);
      }

      merchant.setCurrentEnvironment(input.environment);
      await repos.merchantRepository.update(merchant);

      await repos.refreshTokenRepository.revokeAllForMerchant(merchant.id);

      const accessToken = await this.jwtService.generateAccessToken(
        merchant.id,
        storeId,
        input.environment,
        '15m',
      );

      const refreshTokenString = this.tokenGenerator.generateBase64(32);
      await repos.refreshTokenRepository.create(
        RefreshToken.create({
          token: refreshTokenString,
          merchantId: merchant.id,
        }),
      );

      return {
        accessToken,
        refreshToken: refreshTokenString,
        expiresIn: 900,
        environment: input.environment,
      };
    });
  }
}
