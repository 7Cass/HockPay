import { InvalidRefreshTokenError } from '../../domain/errors/invalid-refresh-token.error';
import { RefreshTokenRevokedError } from '../../domain/errors/refresh-token-revoked.error';
import { TokenExpiredError } from '../../domain/errors/token-expired.error';
import { IJwtServicePort } from '../ports/jwt-service.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

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
    private readonly unitOfWork: IUnitOfWork,
    private readonly jwtService: IJwtServicePort,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: IRefreshTokenInput): Promise<IRefreshTokenOutput> {
    return this.unitOfWork.execute(async (repos) => {
      // 1. Find the refresh token and lock it for rotation
      const existingToken =
        await repos.refreshTokenRepository.findByTokenForUpdate(
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
      const merchant = await repos.merchantRepository.findByIdForUpdate(
        existingToken.merchantId,
      );

      if (!merchant || !merchant.canLogin()) {
        // Revoke the token since merchant is not valid
        existingToken.revoke();
        await repos.refreshTokenRepository.update(existingToken);
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
      await repos.refreshTokenRepository.revokeAllForMerchant(merchant.id);

      // 8. Create new refresh token entity (7 days expiration - default)
      const newRefreshToken = RefreshToken.create({
        token: newRefreshTokenString,
        merchantId: merchant.id,
      });

      // 9. Save new refresh token
      await repos.refreshTokenRepository.create(newRefreshToken);

      // 10. Return output
      return {
        accessToken,
        refreshToken: newRefreshTokenString,
        expiresIn: 900, // 15 minutes in seconds
      };
    });
  }
}
