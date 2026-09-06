/**
 * Port interface for the operator JWT service.
 *
 * It is a separate port from IJwtServicePort, backed by a separate secret: a
 * merchant token does not verify here even if some guard forgets to look at
 * the audience.
 */
export interface IOperatorJwtServicePort {
  /**
   * Generate an access token for an operator.
   *
   * @param sub - The operator ID (subject)
   * @param expiresIn - Token expiration time (e.g., '15m')
   */
  generateAccessToken(sub: string, expiresIn?: string): Promise<string>;

  /**
   * Verify and decode an operator token.
   *
   * @throws Error if the token is invalid, expired or issued for another audience
   */
  verifyToken(token: string): Promise<OperatorJwtPayload>;
}

/**
 * Operator token payload.
 *
 * It carries no store and no merchant: an operator session is not scoped to a
 * store, and reading store data is a power granted by route, not by token.
 */
export interface OperatorJwtPayload {
  sub: string;
  aud: 'operator';
  iat?: number;
  exp?: number;
}
