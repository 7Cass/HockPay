import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { StoreInactiveError } from '../../domain/errors/store-inactive.error';
import { IJwtServicePort } from '../ports/jwt-service.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { MerchantNotFoundError } from '../../domain/errors/merchant-not-found.error';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * Input DTO for SwitchStoreUseCase.
 */
export interface ISwitchStoreInput {
  merchantId: string;
  storeId: string;
}

/**
 * Output DTO for SwitchStoreUseCase.
 */
export interface ISwitchStoreOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  store: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Use Case: Switch Store
 *
 * This use case handles switching the current store for a merchant.
 * It validates the store, updates the merchant's current store,
 * revokes old tokens, and generates new tokens with the store context.
 */
export class SwitchStoreUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly jwtService: IJwtServicePort,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: ISwitchStoreInput): Promise<ISwitchStoreOutput> {
    return this.unitOfWork.execute(async (repos) => {
      // 1. Verify store ownership
      const store = await repos.storeRepository.findByIdAndMerchantId(
        input.storeId,
        input.merchantId,
      );

      if (!store) {
        throw new StoreNotFoundError(input.storeId);
      }

      // 2. Validate store is active
      if (!store.isActive) {
        throw new StoreInactiveError(input.storeId);
      }

      // 4. Get merchant and update current store
      const merchant = await repos.merchantRepository.findByIdForUpdate(input.merchantId);

      if (!merchant) {
        throw new MerchantNotFoundError(input.merchantId);
      }

      merchant.setCurrentStoreId(store.id);

      // LIVE enablement is a fact of the *store*. Carrying LIVE from an
      // approved store into one that never asked would leave the session in a
      // state no rule authorised -- and the enablement gate would not even be
      // consulted, because nobody "switched environment". Resetting is the only
      // way the invariant holds without a second place to check it.
      merchant.setCurrentEnvironment(Environment.TEST);

      await repos.merchantRepository.update(merchant);

      // 5. Revoke old tokens
      await repos.refreshTokenRepository.revokeAllForMerchant(input.merchantId);

      // 6. Generate new JWT with storeId
      const accessToken = await this.jwtService.generateAccessToken(
        merchant.id,
        store.id,
        merchant.currentEnvironment,
        '15m',
      );

      // 7. Generate new refresh token
      const refreshTokenString = this.tokenGenerator.generateBase64(32);
      const refreshToken = RefreshToken.create({
        token: refreshTokenString,
        merchantId: merchant.id,
      });
      await repos.refreshTokenRepository.create(refreshToken);

      // 8. Return output
      return {
        accessToken,
        refreshToken: refreshTokenString,
        expiresIn: 900, // 15 minutes in seconds
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
        },
      };
    });
  }
}
