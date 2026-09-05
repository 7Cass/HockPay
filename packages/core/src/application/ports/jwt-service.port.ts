/**
 * Audiences a hockpay token can be issued for.
 *
 * A token is only ever valid for the principal named here: a merchant token is
 * rejected on operator routes and vice-versa.
 */
export const TOKEN_AUDIENCE = {
  MERCHANT: 'merchant',
  OPERATOR: 'operator',
} as const;

export type TokenAudience = (typeof TOKEN_AUDIENCE)[keyof typeof TOKEN_AUDIENCE];

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
   * Verify and decode a JWT token.
   *
   * Rejects a token issued for another audience, before any permission is read.
   *
   * @param token - The JWT token to verify
   * @returns The decoded payload
   * @throws Error if the token is invalid, expired or issued for another audience
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
  aud: TokenAudience;
  storeId?: string | null;
  iat?: number;
  exp?: number;
}
