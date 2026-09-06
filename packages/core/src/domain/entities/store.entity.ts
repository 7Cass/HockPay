import { StoreLiveStatus } from '../value-objects/store-live-status.vo';
import { InvalidStoreLiveStatusTransitionError } from '../errors/invalid-store-live-status-transition.error';

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
  private _liveStatus: StoreLiveStatus;
  private _liveStatusReason?: string;
  private _liveStatusChangedAt?: Date;
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
    this._liveStatus = props.liveStatus ?? StoreLiveStatus.NOT_REQUESTED;
    this._liveStatusReason = props.liveStatusReason;
    this._liveStatusChangedAt = props.liveStatusChangedAt;
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
      liveStatus: StoreLiveStatus.NOT_REQUESTED,
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

  get liveStatus(): StoreLiveStatus {
    return this._liveStatus;
  }

  get liveStatusReason(): string | undefined {
    return this._liveStatusReason;
  }

  get liveStatusChangedAt(): Date | undefined {
    return this._liveStatusChangedAt;
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
   *
   * This is about the store being switched on at all -- it says nothing about
   * LIVE. TEST works for every live status; see `isLiveEnabled`.
   */
  canBeUsed(): boolean {
    return this._isActive;
  }

  /**
   * Check if the desk has opened LIVE for this store.
   *
   * The single rule that gates LIVE: only APPROVED counts. A suspended store is
   * closed again, and a pending one was never open.
   */
  isLiveEnabled(): boolean {
    return this._liveStatus === StoreLiveStatus.APPROVED;
  }

  /**
   * Merchant asks the desk for LIVE enablement.
   *
   * Allowed from NOT_REQUESTED and from REJECTED -- a refused merchant may fix
   * whatever was wrong and ask again. A suspended store cannot re-request:
   * reinstating is the desk's decision, with a reason.
   */
  requestLive(): void {
    this.transitionLive(
      [StoreLiveStatus.NOT_REQUESTED, StoreLiveStatus.REJECTED],
      StoreLiveStatus.PENDING,
      undefined,
    );
  }

  /**
   * Desk grants LIVE. Valid from PENDING, and from SUSPENDED (reinstatement).
   */
  approveLive(reason: string): void {
    this.transitionLive(
      [StoreLiveStatus.PENDING, StoreLiveStatus.SUSPENDED],
      StoreLiveStatus.APPROVED,
      reason,
    );
  }

  /**
   * Desk refuses the request. Valid only from PENDING.
   */
  rejectLive(reason: string): void {
    this.transitionLive([StoreLiveStatus.PENDING], StoreLiveStatus.REJECTED, reason);
  }

  /**
   * Desk revokes an enablement it had granted. Valid only from APPROVED.
   */
  suspendLive(reason: string): void {
    this.transitionLive([StoreLiveStatus.APPROVED], StoreLiveStatus.SUSPENDED, reason);
  }

  private transitionLive(from: StoreLiveStatus[], to: StoreLiveStatus, reason?: string): void {
    if (!from.includes(this._liveStatus)) {
      throw new InvalidStoreLiveStatusTransitionError(this._liveStatus, to);
    }

    const now = new Date();
    this._liveStatus = to;
    this._liveStatusReason = reason;
    this._liveStatusChangedAt = now;
    this._updatedAt = now;
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
      liveStatus: this._liveStatus,
      liveStatusReason: this._liveStatusReason,
      liveStatusChangedAt: this._liveStatusChangedAt,
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
  liveStatus: StoreLiveStatus;
  liveStatusReason?: string;
  liveStatusChangedAt?: Date;
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
  liveStatus: StoreLiveStatus;
  liveStatusReason?: string;
  liveStatusChangedAt?: Date;
  settlementDays: number;
  feePercent: number;
  feeFixed: number;
  city?: string;
  createdAt: Date;
  updatedAt: Date;
}
