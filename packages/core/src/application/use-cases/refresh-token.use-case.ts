import { InvalidRefreshTokenError } from '../../domain/errors/invalid-refresh-token.error';
import { RefreshTokenRevokedError } from '../../domain/errors/refresh-token-revoked.error';
import { TokenExpiredError } from '../../domain/errors/token-expired.error';
import { IMerchantRepository } from '../../domain/repositories/merchant.repository.interface';
import { IJwtServicePort } from '../ports/jwt-service.port';
import { IRefreshTokenRepositoryPort } from '../ports/refresh-token-repository.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';

/**
 * Input DTO for RefreshTokenUseCase.
 */
export interface IRefreshTokenInput {
  refreshToken: string;
}

/**
 * Output DTO for RefreshTokenUseCase.
 */
export interface IRefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Use Case: Refresh Token
 *
 * This use case handles token refresh using a refresh token.
 * It validates the refresh token, generates a new access token,
 * and optionally rotates the refresh token.
 */
export class RefreshTokenUseCase {
  constructor(
    private readonly merchantRepository: IMerchantRepository,
    private readonly jwtService: IJwtServicePort,
    private readonly refreshTokenRepository: IRefreshTokenRepositoryPort,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: IRefreshTokenInput): Promise<IRefreshTokenOutput> {
    // 1. Find the refresh token
    const existingToken = await this.refreshTokenRepository.findByToken(
      input.refreshToken,
    );

    if (!existingToken) {
      throw new InvalidRefreshTokenError();
    }

    // 2. Check if token is expired
    if (existingToken.isExpired()) {
      throw new TokenExpiredError();
    }

    // 3. Check if token is revoked
    if (existingToken.isRevoked()) {
      throw new RefreshTokenRevokedError();
    }

    // 4. Verify merchant exists and is active
    const merchant = await this.merchantRepository.findById(
      existingToken.merchantId,
    );

    if (!merchant || !merchant.canLogin()) {
      // Revoke the token since merchant is not valid
      existingToken.revoke();
      await this.refreshTokenRepository.update(existingToken);
      throw new InvalidRefreshTokenError();
    }

    // 5. Generate new access token with current store if available
    const accessToken = await this.jwtService.generateAccessToken(
      merchant.id,
      merchant.currentStoreId ?? null,
      '15m',
    );

    // 6. Generate new refresh token (token rotation)
    const newRefreshTokenString = this.tokenGenerator.generateBase64(32);

    // 7. Revoke all old tokens for this merchant (hard delete)
    // This allows creating a new token with the same merchantId
    await this.refreshTokenRepository.revokeAllForMerchant(merchant.id);

    // 8. Create new refresh token entity (7 days expiration - default)
    const newRefreshToken = RefreshToken.create({
      token: newRefreshTokenString,
      merchantId: merchant.id,
    });

    // 9. Save new refresh token
    await this.refreshTokenRepository.create(newRefreshToken);

    // 10. Return output
    return {
      accessToken,
      refreshToken: newRefreshTokenString,
      expiresIn: 900, // 15 minutes in seconds
    };
  }
}
