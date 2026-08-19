/**
 * Domain Entity: Store
 *
 * Represents a store belonging to a merchant.
 * Each merchant can have multiple stores, and operations are scoped to a store.
 */
export class Store {
  private readonly _id: string;
  private readonly _merchantId: string;
  private _name: string;
  private readonly _slug: string;
  private readonly _isActive: boolean;
  private readonly _isApproved: boolean;
  private readonly _settlementDays: number;
  private readonly _feePercent: number;
  private readonly _feeFixed: number;
  private _city?: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: StoreProps) {
    this._id = props.id;
    this._merchantId = props.merchantId;
    this._name = props.name;
    this._slug = props.slug;
    this._isActive = props.isActive ?? true;
    this._isApproved = props.isApproved ?? false;
    this._settlementDays = props.settlementDays ?? 30;
    this._feePercent = props.feePercent ?? 1.5;
    this._feeFixed = props.feeFixed ?? 15;
    this._city = props.city;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new Store.
   */
  static create(props: CreateStoreProps): Store {
    return new Store({
      id: crypto.randomUUID(),
      merchantId: props.merchantId,
      name: props.name,
      slug: props.slug,
      isActive: true,
      isApproved: props.isApproved ?? false,
      settlementDays: props.settlementDays ?? 30,
      feePercent: props.feePercent ?? 1.5,
      feeFixed: props.feeFixed ?? 15,
      city: props.city,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute a Store from persistence.
   */
  static reconstitute(props: StoreProps): Store {
    return new Store(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get merchantId(): string {
    return this._merchantId;
  }

  get name(): string {
    return this._name;
  }

  get slug(): string {
    return this._slug;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isApproved(): boolean {
    return this._isApproved;
  }

  get settlementDays(): number {
    return this._settlementDays;
  }

  get feePercent(): number {
    return this._feePercent;
  }

  get feeFixed(): number {
    return this._feeFixed;
  }

  get city(): string | undefined {
    return this._city;
  }

  updateProfile(input: { name: string; city?: string | null }): void {
    const name = input.name.trim();
    if (name) {
      this._name = name;
    }
    if (input.city !== undefined) {
      this._city = input.city?.trim() || undefined;
    }
    this._updatedAt = new Date();
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Check if this store can be used for operations.
   * A store can be used if it's both active and approved.
   */
  canBeUsed(): boolean {
    return this._isActive && this._isApproved;
  }

  /**
   * Check if this store belongs to a specific merchant.
   */
  belongsTo(merchantId: string): boolean {
    return this._merchantId === merchantId;
  }

  /**
   * Convert to plain object (useful for serialization).
   */
  toObject(): StoreObject {
    return {
      id: this._id,
      merchantId: this._merchantId,
      name: this._name,
      slug: this._slug,
      isActive: this._isActive,
      isApproved: this._isApproved,
      settlementDays: this._settlementDays,
      feePercent: this._feePercent,
      feeFixed: this._feeFixed,
      city: this._city,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

/**
 * Properties needed to create a new Store.
 */
export interface CreateStoreProps {
  merchantId: string;
  name: string;
  slug: string;
  settlementDays?: number;
  feePercent?: number;
  feeFixed?: number;
  isApproved?: boolean;
  city?: string;
}

/**
 * All properties of a Store (for reconstitution from persistence).
 */
export interface StoreProps {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  isActive: boolean;
  isApproved: boolean;
  settlementDays: number;
  feePercent: number;
  feeFixed: number;
  city?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified object representation of a Store (for serialization).
 */
export interface StoreObject {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  isActive: boolean;
  isApproved: boolean;
  settlementDays: number;
  feePercent: number;
  feeFixed: number;
  city?: string;
  createdAt: Date;
  updatedAt: Date;
}
