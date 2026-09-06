/**
 * Domain Entity: OperatorRefreshToken
 *
 * Mirrors RefreshToken for the operator principal, including the rule of one
 * active token per owner. It is deliberately a separate entity: a merchant
 * refresh token must never be usable to mint an operator session.
 */
export class OperatorRefreshToken {
  private readonly _id: string;
  private readonly _token: string;
  private readonly _operatorId: string;
  private readonly _expiresAt: Date;
  private _revokedAt?: Date;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(props: OperatorRefreshTokenProps) {
    this._id = props.id;
    this._token = props.token;
    this._operatorId = props.operatorId;
    this._expiresAt = props.expiresAt;
    this._revokedAt = props.revokedAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateOperatorRefreshTokenProps): OperatorRefreshToken {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + (props.expiresInDays ?? 7));

    return new OperatorRefreshToken({
      id: crypto.randomUUID(),
      token: props.token,
      operatorId: props.operatorId,
      expiresAt,
      revokedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: OperatorRefreshTokenProps): OperatorRefreshToken {
    return new OperatorRefreshToken(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get token(): string {
    return this._token;
  }

  get operatorId(): string {
    return this._operatorId;
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

  isValid(): boolean {
    return !this.isRevoked() && !this.isExpired();
  }

  isRevoked(): boolean {
    return this._revokedAt !== undefined;
  }

  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  revoke(): void {
    if (this.isRevoked()) {
      return;
    }
    this._revokedAt = new Date();
  }
}

export interface CreateOperatorRefreshTokenProps {
  operatorId: string;
  token: string;
  expiresInDays?: number;
}

export interface OperatorRefreshTokenProps {
  id: string;
  token: string;
  operatorId: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
