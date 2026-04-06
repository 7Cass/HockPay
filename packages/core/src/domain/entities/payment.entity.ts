import {
  PaymentStatus,
  VALID_STATUS_TRANSITIONS,
  TERMINAL_STATUSES,
} from "../enums/payment-status.enum";
import { Environment } from "../value-objects/environment.vo";
import { InvalidPaymentStatusError } from "../errors/invalid-payment-status.error";

export enum PaymentMethod {
  PIX = "PIX",
  CREDIT_CARD = "CREDIT_CARD",
  BOLETO = "BOLETO",
  DEBIT_CARD = "DEBIT_CARD",
}

/**
 * Domain Entity: Payment
 *
 * Aggregate root representing a Pix payment transaction.
 * Contains business logic for status transitions and validation.
 */
export class Payment {
  private readonly _id: string;
  private readonly _storeId: string;
  private readonly _customerId: string;
  private _externalId?: string;
  private readonly _amount: number;
  private readonly _fee: number;
  private readonly _netAmount: number;
  private readonly _currency: string;
  private _description?: string;
  private _status: PaymentStatus;
  private readonly _environment: Environment;
  private readonly _paymentMethod: PaymentMethod;
  private readonly _paymentDetails?: Record<string, unknown>;
  private readonly _acquirerId?: string;
  private _totalRefunded: number;
  private _pixQrCode?: string;
  private _pixCopyPaste?: string;
  private _pixTxId?: string;
  private readonly _expiresAt: Date;
  private _paidAt?: Date;
  private _releasedAt?: Date;
  private _failedReason?: string;
  private readonly _metadata?: Record<string, unknown>;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: PaymentProps) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._customerId = props.customerId;
    this._externalId = props.externalId;
    this._amount = props.amount;
    this._fee = props.fee;
    this._netAmount = props.netAmount;
    this._currency = props.currency ?? "BRL";
    this._description = props.description;
    this._status = props.status;
    this._environment = props.environment ?? Environment.TEST;
    this._paymentMethod = props.paymentMethod ?? PaymentMethod.PIX;
    this._paymentDetails = props.paymentDetails;
    this._acquirerId = props.acquirerId;
    this._totalRefunded = props.totalRefunded ?? 0;
    this._pixQrCode = props.pixQrCode;
    this._pixCopyPaste = props.pixCopyPaste;
    this._pixTxId = props.pixTxId;
    this._expiresAt = props.expiresAt;
    this._paidAt = props.paidAt;
    this._releasedAt = props.releasedAt;
    this._failedReason = props.failedReason;
    this._metadata = props.metadata;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new Payment.
   * Use this when creating a brand new payment (not from persistence).
   */
  static create(props: CreatePaymentProps): Payment {
    return new Payment({
      id: crypto.randomUUID(),
      storeId: props.storeId,
      customerId: props.customerId,
      externalId: props.externalId,
      amount: props.amount,
      fee: props.fee,
      netAmount: props.netAmount,
      currency: props.currency ?? "BRL",
      description: props.description,
      status: PaymentStatus.PENDING,
      environment: props.environment ?? Environment.TEST,
      paymentMethod: props.paymentMethod ?? PaymentMethod.PIX,
      paymentDetails: props.paymentDetails,
      acquirerId: props.acquirerId,
      totalRefunded: 0,
      pixQrCode: props.pixQrCode,
      pixCopyPaste: props.pixCopyPaste,
      pixTxId: props.pixTxId,
      expiresAt: props.expiresAt,
      metadata: props.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute a Payment from persistence.
   * Use this when loading a payment from the database.
   */
  static reconstitute(props: PaymentProps): Payment {
    return new Payment(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get storeId(): string {
    return this._storeId;
  }

  get customerId(): string {
    return this._customerId;
  }

  get externalId(): string | undefined {
    return this._externalId;
  }

  get amount(): number {
    return this._amount;
  }

  get fee(): number {
    return this._fee;
  }

  get netAmount(): number {
    return this._netAmount;
  }

  get currency(): string {
    return this._currency;
  }

  get description(): string | undefined {
    return this._description;
  }

  get status(): PaymentStatus {
    return this._status;
  }

  get environment(): Environment {
    return this._environment;
  }

  get paymentMethod(): PaymentMethod {
    return this._paymentMethod;
  }

  get paymentDetails(): Record<string, unknown> | undefined {
    return this._paymentDetails;
  }

  get acquirerId(): string | undefined {
    return this._acquirerId;
  }

  get totalRefunded(): number {
    return this._totalRefunded;
  }

  get pixQrCode(): string | undefined {
    return this._pixQrCode;
  }

  get pixCopyPaste(): string | undefined {
    return this._pixCopyPaste;
  }

  get pixTxId(): string | undefined {
    return this._pixTxId;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get paidAt(): Date | undefined {
    return this._paidAt;
  }

  get releasedAt(): Date | undefined {
    return this._releasedAt;
  }

  get failedReason(): string | undefined {
    return this._failedReason;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._metadata;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Status checks

  /**
   * Check if payment is in PENDING status.
   */
  isPending(): boolean {
    return this._status === PaymentStatus.PENDING;
  }

  /**
   * Check if payment is in CONFIRMED status.
   */
  isConfirmed(): boolean {
    return this._status === PaymentStatus.CONFIRMED;
  }

  isReleased(): boolean {
    return this._status === PaymentStatus.RELEASED;
  }

  /**
   * Check if payment is in a terminal state (no further transitions possible).
   */
  isTerminal(): boolean {
    return TERMINAL_STATUSES.has(this._status);
  }

  /**
   * Check if payment has expired (past expiresAt) while still pending.
   * This is used for lazy expiration checks.
   */
  hasExpired(): boolean {
    return (
      this._status === PaymentStatus.PENDING && new Date() > this._expiresAt
    );
  }

  // Business methods

  /**
   * Confirm the payment (PENDING → CONFIRMED).
   * Called when the customer successfully pays the Pix QR code.
   */
  confirm(pixTxId?: string): void {
    this.validateTransition(PaymentStatus.CONFIRMED);

    this._status = PaymentStatus.CONFIRMED;
    this._paidAt = new Date();
    if (pixTxId) {
      this._pixTxId = pixTxId;
    }
    this._updatedAt = new Date();
  }

  /**
   * Expire the payment (PENDING → EXPIRED).
   * Called when the payment expires before being paid.
   */
  expire(): void {
    this.validateTransition(PaymentStatus.EXPIRED);

    this._status = PaymentStatus.EXPIRED;
    this._updatedAt = new Date();
  }

  /**
   * Fail the payment (PENDING → FAILED).
   * Called when the payment fails for any reason.
   */
  fail(reason: string): void {
    this.validateTransition(PaymentStatus.FAILED);

    this._status = PaymentStatus.FAILED;
    this._failedReason = reason;
    this._updatedAt = new Date();
  }

  /**
   * Release the payment (CONFIRMED → RELEASED).
   * Called when funds are released to the merchant's account.
   */
  release(): void {
    this.validateTransition(PaymentStatus.RELEASED);

    this._status = PaymentStatus.RELEASED;
    this._releasedAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Refund the payment (CONFIRMED/RELEASED → REFUNDED).
   * Called when a refund is processed.
   */
  refund(): void {
    this.validateTransition(PaymentStatus.REFUNDED);

    this._status = PaymentStatus.REFUNDED;
    this._updatedAt = new Date();
  }

  /**
   * Add a partial refund amount to the total refunded.
   * If totalRefunded >= amount, the payment status changes to REFUNDED.
   */
  addRefund(amount: number): void {
    if (amount <= 0) {
      throw new Error("Refund amount must be positive");
    }
    if (this._totalRefunded + amount > this._amount) {
      throw new Error("Refund amount exceeds payment amount");
    }

    this._totalRefunded += amount;
    this._updatedAt = new Date();

    if (this._totalRefunded >= this._amount) {
      this.refund();
    }
  }

  /**
   * Validate if a status transition is allowed.
   * Throws InvalidPaymentStatusError if not valid.
   */
  private validateTransition(targetStatus: PaymentStatus): void {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[this._status];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new InvalidPaymentStatusError(this._status, targetStatus);
    }
  }

  /**
   * Convert to plain object (useful for serialization).
   */
  toObject(): PaymentObject {
    return {
      id: this._id,
      storeId: this._storeId,
      customerId: this._customerId,
      externalId: this._externalId,
      amount: this._amount,
      fee: this._fee,
      netAmount: this._netAmount,
      currency: this._currency,
      description: this._description,
      status: this._status,
      environment: this._environment,
      paymentMethod: this._paymentMethod,
      paymentDetails: this._paymentDetails,
      acquirerId: this._acquirerId,
      totalRefunded: this._totalRefunded,
      pixQrCode: this._pixQrCode,
      pixCopyPaste: this._pixCopyPaste,
      pixTxId: this._pixTxId,
      expiresAt: this._expiresAt,
      paidAt: this._paidAt,
      releasedAt: this._releasedAt,
      failedReason: this._failedReason,
      metadata: this._metadata,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

/**
 * Properties needed to create a new Payment.
 */
export interface CreatePaymentProps {
  storeId: string;
  customerId: string;
  externalId?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency?: string;
  description?: string;
  environment?: Environment;
  paymentMethod?: PaymentMethod;
  paymentDetails?: Record<string, unknown>;
  acquirerId?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixTxId?: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * All properties of a Payment (for reconstitution from persistence).
 */
export interface PaymentProps {
  id: string;
  storeId: string;
  customerId: string;
  externalId?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description?: string;
  status: PaymentStatus;
  environment?: Environment;
  paymentMethod?: PaymentMethod;
  paymentDetails?: Record<string, unknown>;
  acquirerId?: string;
  totalRefunded?: number;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixTxId?: string;
  expiresAt: Date;
  paidAt?: Date;
  releasedAt?: Date;
  failedReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified object representation of a Payment (for serialization).
 */
export interface PaymentObject {
  id: string;
  storeId: string;
  customerId: string;
  externalId?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description?: string;
  status: PaymentStatus;
  environment: Environment;
  paymentMethod: PaymentMethod;
  paymentDetails?: Record<string, unknown>;
  acquirerId?: string;
  totalRefunded: number;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixTxId?: string;
  expiresAt: Date;
  paidAt?: Date;
  releasedAt?: Date;
  failedReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
