import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { StoreInactiveError } from '../../domain/errors/store-inactive.error';
import { StoreNotApprovedError } from '../../domain/errors/store-not-approved.error';
import { IStoreRepository } from '../../domain/repositories/store.repository.interface';
import { IMerchantRepository } from '../../domain/repositories/merchant.repository.interface';
import { IJwtServicePort } from '../ports/jwt-service.port';
import { IRefreshTokenRepositoryPort } from '../ports/refresh-token-repository.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';

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
    private readonly storeRepository: IStoreRepository,
    private readonly merchantRepository: IMerchantRepository,
    private readonly jwtService: IJwtServicePort,
    private readonly refreshTokenRepository: IRefreshTokenRepositoryPort,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: ISwitchStoreInput): Promise<ISwitchStoreOutput> {
    // 1. Verify store ownership
    const store = await this.storeRepository.findByIdAndMerchantId(
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

    // 3. Validate store is approved
    if (!store.isApproved) {
      throw new StoreNotApprovedError(input.storeId);
    }

    // 4. Get merchant and update current store
    const merchant = await this.merchantRepository.findById(input.merchantId);

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    merchant.setCurrentStoreId(store.id);
    await this.merchantRepository.update(merchant);

    // 5. Revoke old tokens
    await this.refreshTokenRepository.revokeAllForMerchant(input.merchantId);

    // 6. Generate new JWT with storeId
    const accessToken = await this.jwtService.generateAccessToken(
      merchant.id,
      store.id,
      '15m',
    );

    // 7. Generate new refresh token
    const refreshTokenString = this.tokenGenerator.generateBase64(32);
    const refreshToken = RefreshToken.create({
      token: refreshTokenString,
      merchantId: merchant.id,
    });
    await this.refreshTokenRepository.create(refreshToken);

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
  }
}
