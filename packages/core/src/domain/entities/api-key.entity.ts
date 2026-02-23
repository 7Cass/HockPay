import { Environment } from '../value-objects/environment.vo';

/**
 * Domain Entity: ApiKey
 *
 * Represents an API key for a store in the system.
 * This is a pure domain entity with no dependencies on external frameworks.
 *
 * The actual API key value is NEVER stored directly - only its SHA-256 hash.
 * The plain key is only returned during creation.
 */
export class ApiKey {
  private readonly _id: string;
  private readonly _storeId: string;
  private readonly _keyHash: string;
  private readonly _prefix: string;
  private readonly _name: string;
  private readonly _environment: Environment;
  private _lastUsedAt?: Date;
  private _revokedAt?: Date;
  private readonly _createdAt: Date;

  private constructor(props: ApiKeyProps) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._keyHash = props.keyHash;
    this._prefix = props.prefix;
    this._name = props.name;
    this._environment = props.environment;
    this._lastUsedAt = props.lastUsedAt;
    this._revokedAt = props.revokedAt;
    this._createdAt = props.createdAt;
  }

  /**
   * Factory method to create a new ApiKey.
   * Use this when creating a brand new API key (not from persistence).
   */
  static create(props: CreateApiKeyProps): ApiKey {
    return new ApiKey({
      id: crypto.randomUUID(),
      storeId: props.storeId,
      keyHash: props.keyHash,
      prefix: props.prefix,
      name: props.name,
      environment: props.environment,
      lastUsedAt: undefined,
      revokedAt: undefined,
      createdAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute an ApiKey from persistence.
   * Use this when loading an API key from the database.
   */
  static reconstitute(props: ApiKeyProps): ApiKey {
    return new ApiKey(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get storeId(): string {
    return this._storeId;
  }

  get keyHash(): string {
    return this._keyHash;
  }

  get prefix(): string {
    return this._prefix;
  }

  get name(): string {
    return this._name;
  }

  get environment(): Environment {
    return this._environment;
  }

  get lastUsedAt(): Date | undefined {
    return this._lastUsedAt;
  }

  get revokedAt(): Date | undefined {
    return this._revokedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // Business methods

  /**
   * Revoke this API key.
   * After revocation, the key can no longer be used for authentication.
   */
  revoke(): void {
    if (this._revokedAt) {
      return; // Already revoked
    }
    this._revokedAt = new Date();
  }

  /**
   * Check if the API key is valid for authentication.
   * A key is valid if it has not been revoked.
   */
  isValid(): boolean {
    return this._revokedAt === undefined;
  }

  /**
   * Check if the API key has been revoked.
   */
  isRevoked(): boolean {
    return this._revokedAt !== undefined;
  }

  /**
   * Update the last used timestamp.
   * This is called when the key is successfully used for authentication.
   */
  updateLastUsed(): void {
    this._lastUsedAt = new Date();
  }

  /**
   * Convert to plain object (useful for serialization).
   * Note: keyHash is excluded for security reasons.
   */
  toObject(): ApiKeyObject {
    return {
      id: this._id,
      storeId: this._storeId,
      prefix: this._prefix,
      name: this._name,
      environment: this._environment,
      lastUsedAt: this._lastUsedAt,
      createdAt: this._createdAt,
      revokedAt: this._revokedAt,
    };
  }

  /**
   * Convert to plain object with the hash (for internal use).
   */
  toObjectWithHash(): ApiKeyObjectWithHash {
    return {
      ...this.toObject(),
      keyHash: this._keyHash,
    };
  }
}

/**
 * Properties needed to create a new ApiKey.
 */
export interface CreateApiKeyProps {
  storeId: string;
  keyHash: string;
  prefix: string;
  name: string;
  environment: Environment;
}

/**
 * All properties of an ApiKey (for reconstitution from persistence).
 */
export interface ApiKeyProps {
  id: string;
  storeId: string;
  keyHash: string;
  prefix: string;
  name: string;
  environment: Environment;
  lastUsedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

/**
 * Simplified object representation of an ApiKey (for serialization).
 * The key hash is excluded for security.
 */
export interface ApiKeyObject {
  id: string;
  storeId: string;
  prefix: string;
  name: string;
  environment: Environment;
  lastUsedAt?: Date;
  createdAt: Date;
  revokedAt?: Date;
}

/**
 * Internal object representation that includes the hash (for repository use).
 */
export interface ApiKeyObjectWithHash extends ApiKeyObject {
  keyHash: string;
}
