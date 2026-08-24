import { Environment } from '../value-objects/environment.vo';

export enum IdempotencyKeyStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export class IdempotencyKey {
  private readonly _id: string;
  private readonly _key: string;
  private readonly _storeId: string;
  private readonly _environment: Environment;
  private readonly _requestMethod: string;
  private readonly _requestPath: string;
  private readonly _requestHash: string;
  private _responseBody?: Record<string, unknown>;
  private _responseStatus?: number;
  private _status: IdempotencyKeyStatus;
  private _completedAt?: Date;
  private readonly _createdAt: Date;
  private readonly _expiresAt: Date;

  private constructor(props: IdempotencyKeyProps) {
    this._id = props.id;
    this._key = props.key;
    this._storeId = props.storeId;
    this._environment = props.environment ?? Environment.TEST;
    this._requestMethod = props.requestMethod.toUpperCase();
    this._requestPath = props.requestPath;
    this._requestHash = props.requestHash;
    this._responseBody = props.responseBody;
    this._responseStatus = props.responseStatus;
    this._status = props.status;
    this._completedAt = props.completedAt;
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
      environment: props.environment ?? Environment.TEST,
      requestMethod: props.requestMethod,
      requestPath: props.requestPath,
      requestHash: props.requestHash,
      responseBody: props.responseBody,
      responseStatus: props.responseStatus,
      status: IdempotencyKeyStatus.COMPLETED,
      completedAt: now,
      createdAt: now,
      expiresAt,
    });
  }

  static reserve(props: ReserveIdempotencyKeyProps): IdempotencyKey {
    const now = new Date();
    const ttlSeconds = props.ttlSeconds ?? 86400;
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    return new IdempotencyKey({
      id: crypto.randomUUID(),
      key: props.key,
      storeId: props.storeId,
      environment: props.environment ?? Environment.TEST,
      requestMethod: props.requestMethod,
      requestPath: props.requestPath,
      requestHash: props.requestHash,
      status: IdempotencyKeyStatus.PENDING,
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

  get environment(): Environment {
    return this._environment;
  }

  get requestMethod(): string {
    return this._requestMethod;
  }

  get requestPath(): string {
    return this._requestPath;
  }

  get requestHash(): string {
    return this._requestHash;
  }

  get responseBody(): Record<string, unknown> | undefined {
    return this._responseBody;
  }

  get responseStatus(): number | undefined {
    return this._responseStatus;
  }

  get status(): IdempotencyKeyStatus {
    return this._status;
  }

  get completedAt(): Date | undefined {
    return this._completedAt;
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

  matchesRequest(input: {
    requestMethod: string;
    requestPath: string;
    requestHash: string;
  }): boolean {
    return (
      this._requestMethod === input.requestMethod.toUpperCase() &&
      this._requestPath === input.requestPath &&
      this._requestHash === input.requestHash
    );
  }

  isCompleted(): boolean {
    return (
      this._status === IdempotencyKeyStatus.COMPLETED &&
      this._responseBody !== undefined &&
      this._responseStatus !== undefined
    );
  }

  complete(responseBody: Record<string, unknown>, responseStatus: number): void {
    this._responseBody = responseBody;
    this._responseStatus = responseStatus;
    this._status = IdempotencyKeyStatus.COMPLETED;
    this._completedAt = new Date();
  }

  /**
   * Convert to plain object (useful for serialization).
   */
  toObject(): IdempotencyKeyObject {
    return {
      id: this._id,
      key: this._key,
      storeId: this._storeId,
      environment: this._environment,
      requestMethod: this._requestMethod,
      requestPath: this._requestPath,
      requestHash: this._requestHash,
      responseBody: this._responseBody,
      responseStatus: this._responseStatus,
      status: this._status,
      completedAt: this._completedAt,
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
  environment: Environment;
  requestMethod: string;
  requestPath: string;
  requestHash: string;
  responseBody: Record<string, unknown>;
  responseStatus: number;
  ttlSeconds?: number;
}

export interface ReserveIdempotencyKeyProps {
  key: string;
  storeId: string;
  environment: Environment;
  requestMethod: string;
  requestPath: string;
  requestHash: string;
  ttlSeconds?: number;
}

/**
 * All properties of an IdempotencyKey (for reconstitution from persistence).
 */
export interface IdempotencyKeyProps {
  id: string;
  key: string;
  storeId: string;
  environment?: Environment;
  requestMethod: string;
  requestPath: string;
  requestHash: string;
  responseBody?: Record<string, unknown>;
  responseStatus?: number;
  status: IdempotencyKeyStatus;
  completedAt?: Date;
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
  environment: Environment;
  requestMethod: string;
  requestPath: string;
  requestHash: string;
  responseBody?: Record<string, unknown>;
  responseStatus?: number;
  status: IdempotencyKeyStatus;
  completedAt?: Date;
  createdAt: Date;
  expiresAt: Date;
}
