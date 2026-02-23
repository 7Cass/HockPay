/**
 * Domain Entity: RefreshToken
 *
 * Represents a refresh token associated with a merchant account.
 * This is a pure domain entity with no dependencies on external frameworks.
 *
 * Business Rules:
 * - One active refresh token per merchant at a time
 * - Token expires after 7 days
 * - Token can be revoked (logout)
 * - Revoked tokens cannot be used
 */
export class RefreshToken {
  private readonly _id: string;
  private readonly _token: string;
  private readonly _merchantId: string;
  private readonly _expiresAt: Date;
  private _revokedAt?: Date;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(props: RefreshTokenProps) {
    this._id = props.id;
    this._token = props.token;
    this._merchantId = props.merchantId;
    this._expiresAt = props.expiresAt;
    this._revokedAt = props.revokedAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new RefreshToken.
   * Use this when creating a brand new refresh token.
   *
   * @param merchantId - The merchant ID this token belongs to
   * @param token - The generated token string
   * @param expiresInDays - Number of days until expiration (default: 7)
   */
  static create(props: CreateRefreshTokenProps): RefreshToken {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + (props.expiresInDays ?? 7));

    return new RefreshToken({
      id: crypto.randomUUID(),
      token: props.token,
      merchantId: props.merchantId,
      expiresAt,
      revokedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Factory method to reconstitute a RefreshToken from persistence.
   * Use this when loading a token from the database.
   */
  static reconstitute(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get token(): string {
    return this._token;
  }

  get merchantId(): string {
    return this._merchantId;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get revokedAt(): Date | undefined {
    return this._revokedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Check if the token is currently valid.
   * A token is valid if it's not revoked and not expired.
   */
  isValid(): boolean {
    return !this.isRevoked() && !this.isExpired();
  }

  /**
   * Check if the token has been revoked.
   */
  isRevoked(): boolean {
    return this._revokedAt !== undefined;
  }

  /**
   * Check if the token has expired.
   */
  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  /**
   * Revoke the token (used on logout).
   * This makes the token invalid immediately.
   */
  revoke(): void {
    if (this.isRevoked()) {
      return;
    }
    this._revokedAt = new Date();
  }

  /**
   * Convert to plain object (useful for serialization).
   */
  toObject(): RefreshTokenObject {
    return {
      id: this._id,
      token: this._token,
      merchantId: this._merchantId,
      expiresAt: this._expiresAt,
      revokedAt: this._revokedAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      isValid: this.isValid(),
      isRevoked: this.isRevoked(),
      isExpired: this.isExpired(),
    };
  }
}

/**
 * Properties needed to create a new RefreshToken.
 */
export interface CreateRefreshTokenProps {
  merchantId: string;
  token: string;
  expiresInDays?: number;
}

/**
 * All properties of a RefreshToken (for reconstitution from persistence).
 */
export interface RefreshTokenProps {
  id: string;
  token: string;
  merchantId: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified object representation of a RefreshToken (for serialization).
 */
export interface RefreshTokenObject {
  id: string;
  token: string;
  merchantId: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isValid: boolean;
  isRevoked: boolean;
  isExpired: boolean;
}
