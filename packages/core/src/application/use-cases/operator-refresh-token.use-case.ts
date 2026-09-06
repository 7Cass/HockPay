import { InvalidRefreshTokenError } from '../../domain/errors/invalid-refresh-token.error';
import { RefreshTokenRevokedError } from '../../domain/errors/refresh-token-revoked.error';
import { TokenExpiredError } from '../../domain/errors/token-expired.error';
import { IOperatorJwtServicePort } from '../ports/operator-jwt-service.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { OperatorRefreshToken } from '../../domain/entities/operator-refresh-token.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export interface IOperatorRefreshTokenInput {
  refreshToken: string;
}

export interface IOperatorRefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Use Case: Operator Refresh Token
 *
 * Rotates an operator session. A deactivated operator loses the session here,
 * which is what keeps a 15 minute access token from outliving the decision to
 * deactivate by more than its own lifetime.
 */
export class OperatorRefreshTokenUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly jwtService: IOperatorJwtServicePort,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: IOperatorRefreshTokenInput): Promise<IOperatorRefreshTokenOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const existingToken = await repos.operatorRefreshTokenRepository.findByTokenForUpdate(
        input.refreshToken,
      );

      if (!existingToken) {
        throw new InvalidRefreshTokenError();
      }

      if (existingToken.isExpired()) {
        throw new TokenExpiredError();
      }

      if (existingToken.isRevoked()) {
        throw new RefreshTokenRevokedError();
      }

      const operator = await repos.operatorRepository.findByIdForUpdate(existingToken.operatorId);

      if (!operator || !operator.canLogin()) {
        existingToken.revoke();
        await repos.operatorRefreshTokenRepository.update(existingToken);
        throw new InvalidRefreshTokenError();
      }

      const accessToken = await this.jwtService.generateAccessToken(operator.id, '15m');
      const newRefreshTokenString = this.tokenGenerator.generateBase64(32);

      await repos.operatorRefreshTokenRepository.revokeAllForOperator(operator.id);
      await repos.operatorRefreshTokenRepository.create(
        OperatorRefreshToken.create({
          token: newRefreshTokenString,
          operatorId: operator.id,
        }),
      );

      return {
        accessToken,
        refreshToken: newRefreshTokenString,
        expiresIn: 900,
      };
    });
  }
}
