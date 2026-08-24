import { InvalidRefundStatusError } from '../errors/invalid-refund-status.error';

export class Refund {
  private readonly _id: string;
  private readonly _paymentId: string;
  private readonly _amount: number;
  private readonly _feeRefunded: number;
  private readonly _reason?: string;
  private _status: RefundStatus;
  private _processedAt?: Date;
  private readonly _createdAt: Date;

  private constructor(props: RefundProps) {
    this._id = props.id;
    this._paymentId = props.paymentId;
    this._amount = props.amount;
    this._feeRefunded = props.feeRefunded;
    this._reason = props.reason;
    this._status = props.status;
    this._processedAt = props.processedAt;
    this._createdAt = props.createdAt;
  }

  static create(props: CreateRefundProps): Refund {
    return new Refund({
      id: crypto.randomUUID(),
      paymentId: props.paymentId,
      amount: props.amount,
      feeRefunded: props.feeRefunded ?? 0,
      reason: props.reason,
      status: RefundStatus.PENDING,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: RefundProps): Refund {
    return new Refund(props);
  }

  get id(): string {
    return this._id;
  }
  get paymentId(): string {
    return this._paymentId;
  }
  get amount(): number {
    return this._amount;
  }
  get feeRefunded(): number {
    return this._feeRefunded;
  }
  get reason(): string | undefined {
    return this._reason;
  }
  get status(): RefundStatus {
    return this._status;
  }
  get processedAt(): Date | undefined {
    return this._processedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  isPending(): boolean {
    return this._status === RefundStatus.PENDING;
  }

  isProcessed(): boolean {
    return this._status === RefundStatus.PROCESSED;
  }

  isFailed(): boolean {
    return this._status === RefundStatus.FAILED;
  }

  process(): void {
    if (this._status !== RefundStatus.PENDING) {
      throw new InvalidRefundStatusError('Can only process pending refunds');
    }
    this._status = RefundStatus.PROCESSED;
    this._processedAt = new Date();
  }

  fail(reason?: string): void {
    this._status = RefundStatus.FAILED;
  }

  toObject(): RefundObject {
    return {
      id: this._id,
      paymentId: this._paymentId,
      amount: this._amount,
      feeRefunded: this._feeRefunded,
      reason: this._reason,
      status: this._status,
      processedAt: this._processedAt,
      createdAt: this._createdAt,
    };
  }
}

export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

export interface CreateRefundProps {
  paymentId: string;
  amount: number;
  feeRefunded?: number;
  reason?: string;
}

export interface RefundProps {
  id: string;
  paymentId: string;
  amount: number;
  feeRefunded: number;
  reason?: string;
  status: RefundStatus;
  processedAt?: Date;
  createdAt: Date;
}

export interface RefundObject {
  id: string;
  paymentId: string;
  amount: number;
  feeRefunded: number;
  reason?: string;
  status: RefundStatus;
  processedAt?: Date;
  createdAt: Date;
}
