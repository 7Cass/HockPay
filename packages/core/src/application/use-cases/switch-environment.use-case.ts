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
 * - **Revoking the old refresh token is not housekeeping.** A still-valid TEST
 *   token after a switch to LIVE is a session reading the wrong ledger without
 *   anybody having asked for it.
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
