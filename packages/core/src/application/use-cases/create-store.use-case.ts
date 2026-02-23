import { Store, StoreObject } from '../../domain/entities/store.entity';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { InvalidSlugFormatError } from '../../domain/errors/invalid-slug-format.error';
import { SlugAlreadyExistsError } from '../../domain/errors/slug-already-exists.error';
import { IStoreRepository } from '../../domain/repositories/store.repository.interface';
import { IMerchantRepository } from '../../domain/repositories/merchant.repository.interface';
import { IJwtServicePort } from '../ports/jwt-service.port';
import { IRefreshTokenRepositoryPort } from '../ports/refresh-token-repository.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { ISlugGeneratorPort } from '../ports/slug-generator.port';

/**
 * Input DTO for CreateStoreUseCase.
 */
export interface ICreateStoreInput {
  merchantId: string;
  name: string;
  slug?: string;
}

/**
 * Output DTO for CreateStoreUseCase.
 */
export interface ICreateStoreOutput {
  store: StoreObject;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Use Case: Create Store
 *
 * This use case handles creating a new store for a merchant.
 * It validates/generates the slug, creates the store, updates the merchant's
 * current store, revokes old tokens, and generates new tokens with store context.
 */
export class CreateStoreUseCase {
  constructor(
    private readonly storeRepository: IStoreRepository,
    private readonly merchantRepository: IMerchantRepository,
    private readonly jwtService: IJwtServicePort,
    private readonly refreshTokenRepository: IRefreshTokenRepositoryPort,
    private readonly tokenGenerator: ITokenGeneratorPort,
    private readonly slugGenerator: ISlugGeneratorPort,
  ) {}

  async execute(input: ICreateStoreInput): Promise<ICreateStoreOutput> {
    // 1. Get merchant
    const merchant = await this.merchantRepository.findById(input.merchantId);

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // 2. Validate or generate slug
    let finalSlug: string;

    if (input.slug) {
      // Validate custom slug format
      if (!this.slugGenerator.validateFormat(input.slug)) {
        throw new InvalidSlugFormatError(input.slug);
      }

      // Check if slug is available
      const isAvailable = await this.slugGenerator.isAvailable(input.slug);
      if (!isAvailable) {
        throw new SlugAlreadyExistsError(input.slug);
      }

      finalSlug = input.slug;
    } else {
      // Generate slug from name
      const baseSlug = this.slugGenerator.generateFromName(input.name);
      finalSlug = await this.slugGenerator.generateUnique(baseSlug);
    }

    // 3. Create Store entity (active and approved for MVP/dev mode)
    const store = Store.create({
      merchantId: input.merchantId,
      name: input.name,
      slug: finalSlug,
      isApproved: true, // Auto-approve for MVP
    });

    // 4. Persist Store
    await this.storeRepository.save(store);

    // 5. Update merchant's current store
    merchant.setCurrentStoreId(store.id);
    await this.merchantRepository.update(merchant);

    // 6. Revoke old tokens
    await this.refreshTokenRepository.revokeAllForMerchant(input.merchantId);

    // 7. Generate new JWT with storeId
    const accessToken = await this.jwtService.generateAccessToken(
      merchant.id,
      store.id,
      '15m',
    );

    // 8. Generate new refresh token
    const refreshTokenString = this.tokenGenerator.generateBase64(32);
    const refreshToken = RefreshToken.create({
      token: refreshTokenString,
      merchantId: merchant.id,
    });
    await this.refreshTokenRepository.create(refreshToken);

    // 9. Return output
    return {
      store: store.toObject(),
      accessToken,
      refreshToken: refreshTokenString,
      expiresIn: 900, // 15 minutes in seconds
    };
  }
}
