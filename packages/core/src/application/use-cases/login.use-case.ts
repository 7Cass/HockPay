import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { MerchantInactiveError } from '../../domain/errors/merchant-inactive.error';
import { IPasswordHasherPort } from '../ports/password-hasher.port';
import { IJwtServicePort } from '../ports/jwt-service.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { resolveSessionEnvironment } from '../services/session-environment';

/**
 * Input DTO for LoginUseCase.
 */
export interface ILoginInput {
  email: string;
  password: string;
}

/**
 * Output DTO for LoginUseCase.
 */
export interface ILoginOutput {
  accessToken: string;
  refreshToken: string;
  merchant: {
    id: string;
    name: string;
    email: string;
    document: string;
    formattedDocument: string;
    documentType: 'CPF' | 'CNPJ';
  };
  expiresIn: number;
}

/**
 * Use Case: Login
 *
 * This use case handles merchant authentication.
 * It validates credentials, generates access/refresh tokens, and creates a refresh token entity.
 */
export class LoginUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly passwordHasher: IPasswordHasherPort,
    private readonly jwtService: IJwtServicePort,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: ILoginInput): Promise<ILoginOutput> {
    // 1. Find merchant by email
    const merchant = await this.unitOfWork.execute((repos) =>
      repos.merchantRepository.findByEmail(input.email),
    );

    if (!merchant) {
      throw new InvalidCredentialsError();
    }

    // 2. Verify password
    const isPasswordValid = await this.passwordHasher.verify(input.password, merchant.passwordHash);

    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    // 3. Check if merchant is active
    if (!merchant.canLogin()) {
      throw new MerchantInactiveError();
    }

    return this.unitOfWork.execute(async (repos) => {
      const lockedMerchant = await repos.merchantRepository.findByIdForUpdate(merchant.id);

      if (!lockedMerchant) {
        throw new InvalidCredentialsError();
      }

      if (!lockedMerchant.canLogin()) {
        throw new MerchantInactiveError();
      }

      if (lockedMerchant.passwordHash !== merchant.passwordHash) {
        const isCurrentPasswordValid = await this.passwordHasher.verify(
          input.password,
          lockedMerchant.passwordHash,
        );

        if (!isCurrentPasswordValid) {
          throw new InvalidCredentialsError();
        }
      }

      // 4. Reconfer the LIVE enablement, for the same reason the refresh does:
      // `currentEnvironment` survives a logout, and the desk may have closed
      // LIVE in between. Logging back in is not "asking for LIVE".
      const environment = await resolveSessionEnvironment(repos.storeRepository, lockedMerchant);

      if (environment !== lockedMerchant.currentEnvironment) {
        lockedMerchant.setCurrentEnvironment(environment);
        await repos.merchantRepository.update(lockedMerchant);
      }

      // 5. Generate access token (15 minutes) with current store if available
      const accessToken = await this.jwtService.generateAccessToken(
        lockedMerchant.id,
        lockedMerchant.currentStoreId ?? null,
        environment,
        '15m',
      );

      // 6. Generate refresh token string
      const refreshTokenString = this.tokenGenerator.generateBase64(32);

      // 7. Create refresh token entity (7 days expiration - default)
      const refreshToken = RefreshToken.create({
        token: refreshTokenString,
        merchantId: lockedMerchant.id,
      });

      // 8. Revoke existing refresh tokens for this merchant
      await repos.refreshTokenRepository.revokeAllForMerchant(lockedMerchant.id);

      // 9. Save new refresh token
      await repos.refreshTokenRepository.create(refreshToken);

      // 10. Return the output
      return {
        accessToken,
        refreshToken: refreshTokenString,
        expiresIn: 900, // 15 minutes in seconds
        merchant: {
          id: lockedMerchant.id,
          name: lockedMerchant.name,
          email: lockedMerchant.email.toString(),
          document: lockedMerchant.document.value,
          formattedDocument: lockedMerchant.document.formatted,
          documentType: lockedMerchant.document.type,
        },
      };
    });
  }
}
