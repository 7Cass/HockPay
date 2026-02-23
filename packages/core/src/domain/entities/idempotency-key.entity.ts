/**
 * Domain Entity: IdempotencyKey
 *
 * Represents an idempotency key for safe request retries.
 * Keys are unique per store and expire after 24 hours.
 */
export class IdempotencyKey {
  private readonly _id: string;
  private readonly _key: string;
  private readonly _storeId: string;
  private readonly _requestPath: string;
  private readonly _requestHash: string;
  private readonly _responseBody: Record<string, unknown>;
  private readonly _responseStatus: number;
  private readonly _createdAt: Date;
  private readonly _expiresAt: Date;

  private constructor(props: IdempotencyKeyProps) {
    this._id = props.id;
    this._key = props.key;
    this._storeId = props.storeId;
    this._requestPath = props.requestPath;
    this._requestHash = props.requestHash;
    this._responseBody = props.responseBody;
    this._responseStatus = props.responseStatus;
    this._createdAt = props.createdAt;
    this._expiresAt = props.expiresAt;
  }

  /**
   * Factory method to create a new IdempotencyKey.
   * Use this when caching a new response.
   */
  static create(props: CreateIdempotencyKeyProps): IdempotencyKey {
    const now = new Date();
    const ttlSeconds = props.ttlSeconds ?? 86400; // Default 24 hours
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    return new IdempotencyKey({
      id: crypto.randomUUID(),
      key: props.key,
      storeId: props.storeId,
      requestPath: props.requestPath,
      requestHash: props.requestHash,
      responseBody: props.responseBody,
      responseStatus: props.responseStatus,
      createdAt: now,
      expiresAt,
    });
  }

  /**
   * Factory method to reconstitute from persistence.
   * Use this when loading from the database.
   */
  static reconstitute(props: IdempotencyKeyProps): IdempotencyKey {
    return new IdempotencyKey(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get key(): string {
    return this._key;
  }

  get storeId(): string {
    return this._storeId;
  }

  get requestPath(): string {
    return this._requestPath;
  }

  get requestHash(): string {
    return this._requestHash;
  }

  get responseBody(): Record<string, unknown> {
    return this._responseBody;
  }

  get responseStatus(): number {
    return this._responseStatus;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  /**
   * Check if the key has expired.
   */
  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  /**
   * Check if a request hash matches this key's hash.
   */
  matchesHash(requestHash: string): boolean {
    return this._requestHash === requestHash;
  }

  /**
   * Convert to plain object (useful for serialization).
   */
  toObject(): IdempotencyKeyObject {
    return {
      id: this._id,
      key: this._key,
      storeId: this._storeId,
      requestPath: this._requestPath,
      requestHash: this._requestHash,
      responseBody: this._responseBody,
      responseStatus: this._responseStatus,
      createdAt: this._createdAt,
      expiresAt: this._expiresAt,
    };
  }
}

/**
 * Properties needed to create a new IdempotencyKey.
 */
export interface CreateIdempotencyKeyProps {
  key: string;
  storeId: string;
  requestPath: string;
  requestHash: string;
  responseBody: Record<string, unknown>;
  responseStatus: number;
  ttlSeconds?: number;
}

/**
 * All properties of an IdempotencyKey (for reconstitution from persistence).
 */
export interface IdempotencyKeyProps {
  id: string;
  key: string;
  storeId: string;
  requestPath: string;
  requestHash: string;
  responseBody: Record<string, unknown>;
  responseStatus: number;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Simplified object representation (for serialization).
 */
export interface IdempotencyKeyObject {
  id: string;
  key: string;
  storeId: string;
  requestPath: string;
  requestHash: string;
  responseBody: Record<string, unknown>;
  responseStatus: number;
  createdAt: Date;
  expiresAt: Date;
}
