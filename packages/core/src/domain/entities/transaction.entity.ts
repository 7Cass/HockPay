/**
 * Transaction Type Enum
 */
export enum TransactionType {
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_RELEASED = 'PAYMENT_RELEASED',
  REFUND_DEDUCTED = 'REFUND_DEDUCTED',
  NEGATIVE_COMPENSATED = 'NEGATIVE_COMPENSATED',
  WITHDRAWAL_RESERVED = 'WITHDRAWAL_RESERVED',
  WITHDRAWAL_SENT = 'WITHDRAWAL_SENT',
  WITHDRAWAL_REVERSED = 'WITHDRAWAL_REVERSED',
  FEE_CHARGED = 'FEE_CHARGED',
  ADJUSTMENT = 'ADJUSTMENT',
}

/**
 * Domain Entity: Transaction
 *
 * Represents a financial transaction in an account.
 * Immutable record of all balance changes.
 */
export class Transaction {
  private readonly _id: string;
  private readonly _accountId: string;
  private readonly _type: TransactionType;
  private readonly _amount: number;
  private readonly _fee: number;
  private readonly _netAmount: number;
  private readonly _balanceAfter: number;
  private readonly _referenceType?: string;
  private readonly _referenceId?: string;
  private readonly _description?: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: TransactionProps) {
    this._id = props.id;
    this._accountId = props.accountId;
    this._type = props.type;
    this._amount = props.amount;
    this._fee = props.fee ?? 0;
    this._netAmount = props.netAmount;
    this._balanceAfter = props.balanceAfter;
    this._referenceType = props.referenceType;
    this._referenceId = props.referenceId;
    this._description = props.description;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new Transaction.
   */
  static create(props: CreateTransactionProps): Transaction {
    return new Transaction({
      id: crypto.randomUUID(),
      accountId: props.accountId,
      type: props.type,
      amount: props.amount,
      fee: props.fee ?? 0,
      netAmount: props.netAmount,
      balanceAfter: props.balanceAfter,
      referenceType: props.referenceType,
      referenceId: props.referenceId,
      description: props.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute from persistence.
   */
  static reconstitute(props: TransactionProps): Transaction {
    return new Transaction(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get type(): TransactionType {
    return this._type;
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

  get balanceAfter(): number {
    return this._balanceAfter;
  }

  get referenceType(): string | undefined {
    return this._referenceType;
  }

  get referenceId(): string | undefined {
    return this._referenceId;
  }

  get description(): string | undefined {
    return this._description;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Type checks

  isPaymentReceived(): boolean {
    return this._type === TransactionType.PAYMENT_RECEIVED;
  }

  isPaymentReleased(): boolean {
    return this._type === TransactionType.PAYMENT_RELEASED;
  }

  isWithdrawal(): boolean {
    return (
      this._type === TransactionType.WITHDRAWAL_RESERVED ||
      this._type === TransactionType.WITHDRAWAL_SENT ||
      this._type === TransactionType.WITHDRAWAL_REVERSED
    );
  }

  isRefund(): boolean {
    return this._type === TransactionType.REFUND_DEDUCTED;
  }

  /**
   * Convert to plain object.
   */
  toObject(): TransactionObject {
    return {
      id: this._id,
      accountId: this._accountId,
      type: this._type,
      amount: this._amount,
      fee: this._fee,
      netAmount: this._netAmount,
      balanceAfter: this._balanceAfter,
      referenceType: this._referenceType,
      referenceId: this._referenceId,
      description: this._description,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

/**
 * Properties needed to create a new Transaction.
 */
export interface CreateTransactionProps {
  accountId: string;
  type: TransactionType;
  amount: number;
  fee?: number;
  netAmount: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
}

/**
 * All properties of a Transaction (for reconstitution).
 */
export interface TransactionProps {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  fee: number;
  netAmount: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified object representation.
 */
export interface TransactionObject {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  fee: number;
  netAmount: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Daily aggregation structure for dashboard charts.
 */
export interface DailyVolume {
  date: string; // YYYY-MM-DD
  volume: number; // sum of netAmount
  count: number; // total number of transactions
}
