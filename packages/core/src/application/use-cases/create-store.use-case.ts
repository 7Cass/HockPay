import { Store, StoreObject } from '../../domain/entities/store.entity';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { InvalidSlugFormatError } from '../../domain/errors/invalid-slug-format.error';
import { SlugAlreadyExistsError } from '../../domain/errors/slug-already-exists.error';
import { IJwtServicePort } from '../ports/jwt-service.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { ISlugGeneratorPort } from '../ports/slug-generator.port';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

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
    private readonly unitOfWork: IUnitOfWork,
    private readonly jwtService: IJwtServicePort,
    private readonly tokenGenerator: ITokenGeneratorPort,
    private readonly slugGenerator: ISlugGeneratorPort,
  ) {}

  async execute(input: ICreateStoreInput): Promise<ICreateStoreOutput> {
    // 1. Validate or generate slug
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

    return this.unitOfWork.execute(async (repos) => {
      // 2. Get merchant and lock it for store/token mutation
      const merchant = await repos.merchantRepository.findByIdForUpdate(
        input.merchantId,
      );

      if (!merchant) {
        throw new Error('Merchant not found');
      }

      // 3. Create Store entity (active and approved for MVP/dev mode)
      const store = Store.create({
        merchantId: input.merchantId,
        name: input.name,
        slug: finalSlug,
        isApproved: true, // Auto-approve for MVP
      });

      // 4. Persist Store and its account through the transacted store repository
      await repos.storeRepository.save(store);

      // 5. Update merchant's current store
      merchant.setCurrentStoreId(store.id);
      await repos.merchantRepository.update(merchant);

      // 6. Revoke old tokens
      await repos.refreshTokenRepository.revokeAllForMerchant(input.merchantId);

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
      await repos.refreshTokenRepository.create(refreshToken);

      // 9. Return output
      return {
        store: store.toObject(),
        accessToken,
        refreshToken: refreshTokenString,
        expiresIn: 900, // 15 minutes in seconds
      };
    });
  }
}
