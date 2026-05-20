import { RefreshToken } from '../../domain/entities/refresh-token.entity';

/**
 * Port interface for RefreshToken repository.
 *
 * This port defines the contract for refresh token persistence operations.
 * The infrastructure layer should provide an implementation (e.g., Prisma, Redis).
 */
export interface IRefreshTokenRepositoryPort {
  /**
   * Create a new refresh token.
   * If an active token already exists for the merchant, it should be revoked.
   */
  create(token: RefreshToken): Promise<void>;

  /**
   * Find a refresh token by its token string.
   */
  findByToken(token: string): Promise<RefreshToken | null>;

  /**
   * Find a refresh token and lock the row for the current transaction.
   */
  findByTokenForUpdate(token: string): Promise<RefreshToken | null>;

  /**
   * Find the active refresh token for a merchant.
   */
  findByMerchantId(merchantId: string): Promise<RefreshToken | null>;

  /**
   * Update an existing refresh token (e.g., revoke).
   */
  update(token: RefreshToken): Promise<void>;

  /**
   * Revoke all active tokens for a merchant.
   */
  revokeAllForMerchant(merchantId: string): Promise<void>;

  /**
   * Delete revoked tokens that have expired (cleanup).
   */
  deleteExpired(): Promise<void>;
}
