import { InvalidBalanceError } from '../errors/invalid-balance.error';

export class Account {
  private readonly _id: string;
  private readonly _storeId: string;
  private _available: number;
  private _pending: number;
  private _blocked: number;
  private readonly _currency: string;
  private _updatedAt: Date;

  private constructor(props: AccountProps) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._available = props.available;
    this._pending = props.pending;
    this._blocked = props.blocked;
    this._currency = props.currency ?? 'BRL';
    this._updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new Account.
   */
  static create(props: CreateAccountProps): Account {
    return new Account({
      id: crypto.randomUUID(),
      storeId: props.storeId,
      available: 0,
      pending: 0,
      blocked: 0,
      currency: props.currency ?? 'BRL',
      updatedAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute from persistence.
   */
  static reconstitute(props: AccountProps): Account {
    return new Account(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get storeId(): string {
    return this._storeId;
  }

  get available(): number {
    return this._available;
  }

  get pending(): number {
    return this._pending;
  }

  get blocked(): number {
    return this._blocked;
  }

  get currency(): string {
    return this._currency;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Computed values

  get totalBalance(): number {
    return this._available + this._pending + this._blocked;
  }

  get withdrawableBalance(): number {
    return this._available;
  }

  // Business methods

  /**
   * Add funds to pending balance (when payment is confirmed).
   */
  addToPending(amount: number): void {
    this.validateAmount(amount);
    this._pending += amount;
    this._updatedAt = new Date();
  }

  /**
   * Move funds from pending to available (when payment is released).
   */
  releaseFromPending(amount: number): void {
    this.validateAmount(amount);

    if (amount > this._pending) {
      throw new InvalidBalanceError('Insufficient pending balance');
    }

    this._pending -= amount;
    this._available += amount;
    this._updatedAt = new Date();
  }

  /**
   * Withdraw from available balance.
   */
  withdraw(amount: number): void {
    this.deductFromAvailable(amount);
  }

  /**
   * Deduct from pending balance (for refunds before settlement).
   */
  deductFromPending(amount: number): void {
    this.validateAmount(amount);

    if (amount > this._pending) {
      throw new InvalidBalanceError('Insufficient pending balance');
    }

    this._pending -= amount;
    this._updatedAt = new Date();
  }

  /**
   * Deduct from available balance (for refunds after settlement and withdrawals).
   */
  deductFromAvailable(amount: number): void {
    this.validateAmount(amount);

    if (amount > this._available) {
      throw new InvalidBalanceError('Insufficient available balance');
    }

    this._available -= amount;
    this._updatedAt = new Date();
  }

  /**
   * Block funds from available balance.
   */
  block(amount: number): void {
    this.validateAmount(amount);

    if (amount > this._available) {
      throw new InvalidBalanceError('Insufficient available balance');
    }

    this._available -= amount;
    this._blocked += amount;
    this._updatedAt = new Date();
  }

  /**
   * Unblock funds back to available balance.
   */
  unblock(amount: number): void {
    this.validateAmount(amount);

    if (amount > this._blocked) {
      throw new InvalidBalanceError('Insufficient blocked balance');
    }

    this._blocked -= amount;
    this._available += amount;
    this._updatedAt = new Date();
  }

  /**
   * Deduct from blocked balance (for refunds).
   */
  deductFromBlocked(amount: number): void {
    this.validateAmount(amount);

    if (amount > this._blocked) {
      throw new InvalidBalanceError('Insufficient blocked balance');
    }

    this._blocked -= amount;
    this._updatedAt = new Date();
  }

  /**
   * Validate amount is positive.
   */
  private validateAmount(amount: number): void {
    if (amount < 0) {
      throw new InvalidBalanceError('Amount must be positive');
    }
  }

  /**
   * Convert to plain object.
   */
  toObject(): AccountObject {
    return {
      id: this._id,
      storeId: this._storeId,
      available: this._available,
      pending: this._pending,
      blocked: this._blocked,
      currency: this._currency,
      updatedAt: this._updatedAt,
    };
  }
}

/**
 * Properties needed to create a new Account.
 */
export interface CreateAccountProps {
  storeId: string;
  currency?: string;
}

/**
 * All properties of an Account (for reconstitution).
 */
export interface AccountProps {
  id: string;
  storeId: string;
  available: number;
  pending: number;
  blocked: number;
  currency: string;
  updatedAt: Date;
}

/**
 * Simplified object representation.
 */
export interface AccountObject {
  id: string;
  storeId: string;
  available: number;
  pending: number;
  blocked: number;
  currency: string;
  updatedAt: Date;
}
