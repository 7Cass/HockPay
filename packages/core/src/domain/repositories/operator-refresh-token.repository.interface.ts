import { OperatorRefreshToken } from '../entities/operator-refresh-token.entity';

/**
 * Repository contract for operator refresh tokens.
 *
 * Mirrors the merchant contract, including one active token per owner.
 */
export interface IOperatorRefreshTokenRepository {
  create(token: OperatorRefreshToken): Promise<void>;

  findByToken(token: string): Promise<OperatorRefreshToken | null>;

  /**
   * Find the active token of an operator, so a session can be closed by
   * principal instead of by cookie: the refresh cookie is scoped to the
   * refresh path and never reaches the logout route.
   */
  findByOperatorId(operatorId: string): Promise<OperatorRefreshToken | null>;

  /**
   * Find a token and lock the row for the current transaction (rotation).
   */
  findByTokenForUpdate(token: string): Promise<OperatorRefreshToken | null>;

  update(token: OperatorRefreshToken): Promise<void>;

  revokeAllForOperator(operatorId: string): Promise<void>;
}
