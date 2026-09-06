import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { OperatorInactiveError } from '../../domain/errors/operator-inactive.error';
import { IPasswordHasherPort } from '../ports/password-hasher.port';
import { IOperatorJwtServicePort } from '../ports/operator-jwt-service.port';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { OperatorRefreshToken } from '../../domain/entities/operator-refresh-token.entity';
import {
  OPERATOR_AUDIT_ACTION,
  OperatorAuditLog,
} from '../../domain/entities/operator-audit-log.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export interface IOperatorLoginInput {
  email: string;
  password: string;
  requestId?: string;
}

export interface IOperatorLoginOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  operator: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Use Case: Operator Login
 *
 * Mirrors the merchant login, on a principal of its own: it reads the operator
 * table, mints a token of the operator audience and records the session on the
 * audit trail -- in the same transaction that creates the refresh token.
 */
export class OperatorLoginUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly passwordHasher: IPasswordHasherPort,
    private readonly jwtService: IOperatorJwtServicePort,
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(input: IOperatorLoginInput): Promise<IOperatorLoginOutput> {
    const operator = await this.unitOfWork.execute((repos) =>
      repos.operatorRepository.findByEmail(input.email),
    );

    if (!operator) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await this.passwordHasher.verify(
      input.password,
      operator.passwordHash,
    );

    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    if (!operator.canLogin()) {
      throw new OperatorInactiveError();
    }

    return this.unitOfWork.execute(async (repos) => {
      const lockedOperator = await repos.operatorRepository.findByIdForUpdate(operator.id);

      if (!lockedOperator) {
        throw new InvalidCredentialsError();
      }

      if (!lockedOperator.canLogin()) {
        throw new OperatorInactiveError();
      }

      // The password may have changed between the check above and the lock.
      if (lockedOperator.passwordHash !== operator.passwordHash) {
        const isCurrentPasswordValid = await this.passwordHasher.verify(
          input.password,
          lockedOperator.passwordHash,
        );

        if (!isCurrentPasswordValid) {
          throw new InvalidCredentialsError();
        }
      }

      const accessToken = await this.jwtService.generateAccessToken(lockedOperator.id, '15m');
      const refreshTokenString = this.tokenGenerator.generateBase64(32);

      await repos.operatorRefreshTokenRepository.revokeAllForOperator(lockedOperator.id);
      await repos.operatorRefreshTokenRepository.create(
        OperatorRefreshToken.create({
          token: refreshTokenString,
          operatorId: lockedOperator.id,
        }),
      );

      await repos.operatorAuditLogRepository.append(
        OperatorAuditLog.record({
          operatorId: lockedOperator.id,
          action: OPERATOR_AUDIT_ACTION.LOGIN,
          targetType: 'operator',
          targetId: lockedOperator.id,
          requestId: input.requestId,
        }),
      );

      return {
        accessToken,
        refreshToken: refreshTokenString,
        expiresIn: 900,
        operator: {
          id: lockedOperator.id,
          name: lockedOperator.name,
          email: lockedOperator.email.toString(),
        },
      };
    });
  }
}
