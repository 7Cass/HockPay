/**
 * Port interface for JWT service.
 *
 * This port defines the contract for JWT token operations.
 * The infrastructure layer should provide an implementation (e.g., @nestjs/jwt).
 */
export interface IJwtServicePort {
  /**
   * Generate an access token for a merchant.
   *
   * @param sub - The merchant ID (subject)
   * @param storeId - The current store ID (optional)
   * @param expiresIn - Token expiration time (e.g., '15m', '1h')
   * @returns The signed JWT token
   */
  generateAccessToken(sub: string, storeId: string | null, expiresIn?: string): Promise<string>;

  /**
   * Generate a refresh token for a merchant.
   *
   * @param sub - The merchant ID (subject)
   * @param expiresIn - Token expiration time (e.g., '7d', '30d')
   * @returns The signed JWT token
   */
  generateRefreshToken(sub: string, expiresIn?: string): Promise<string>;

  /**
   * Verify and decode a JWT token.
   *
   * @param token - The JWT token to verify
   * @returns The decoded payload
   * @throws Error if token is invalid or expired
   */
  verifyToken(token: string): Promise<JwtPayload>;

  /**
   * Decode a JWT token without verification (for debugging).
   *
   * @param token - The JWT token to decode
   * @returns The decoded payload or null
   */
  decodeToken(token: string): JwtPayload | null;
}

/**
 * JWT payload structure.
 */
export interface JwtPayload {
  sub: string;
  storeId?: string | null;
  iat?: number;
  exp?: number;
}
