import { LineItemObject } from './line-item.entity';
import { ReceiptAlreadyCancelledError } from '../errors/receipt-already-cancelled.error';

/**
 * Domain Entity: Receipt
 *
 * Represents a payment receipt — a proof of payment issued when a payment
 * is confirmed. Contains snapshot data of payer, payee, and financial details.
 * Receipts are private documents accessible only to parties involved.
 */
export class Receipt {
  private readonly _id: string;
  private readonly _receiptNumber: string;
  private readonly _paymentId: string;
  private readonly _customerId?: string;
  private readonly _storeId: string;
  private _payerName?: string;
  private _payerDocument?: string;
  private _payerEmail?: string;
  private readonly _payeeName: string;
  private _payeeDocument?: string;
  private readonly _amount: number;
  private readonly _fee: number;
  private readonly _netAmount: number;
  private readonly _currency: string;
  private _description?: string;
  private _status: ReceiptStatus;
  private readonly _issuedAt: Date;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ReceiptProps) {
    this._id = props.id;
    this._receiptNumber = props.receiptNumber;
    this._paymentId = props.paymentId;
    this._customerId = props.customerId;
    this._storeId = props.storeId;
    this._payerName = props.payerName;
    this._payerDocument = props.payerDocument;
    this._payerEmail = props.payerEmail;
    this._payeeName = props.payeeName;
    this._payeeDocument = props.payeeDocument;
    this._amount = props.amount;
    this._fee = props.fee;
    this._netAmount = props.netAmount;
    this._currency = props.currency ?? 'BRL';
    this._description = props.description;
    this._status = props.status;
    this._issuedAt = props.issuedAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateReceiptProps): Receipt {
    return new Receipt({
      id: crypto.randomUUID(),
      receiptNumber: props.receiptNumber,
      paymentId: props.paymentId,
      customerId: props.customerId,
      storeId: props.storeId,
      payerName: props.payerName,
      payerDocument: props.payerDocument,
      payerEmail: props.payerEmail,
      payeeName: props.payeeName,
      payeeDocument: props.payeeDocument,
      amount: props.amount,
      fee: props.fee,
      netAmount: props.netAmount,
      currency: props.currency ?? 'BRL',
      description: props.description,
      status: ReceiptStatus.ISSUED,
      issuedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: ReceiptProps): Receipt {
    return new Receipt(props);
  }

  get id(): string {
    return this._id;
  }
  get receiptNumber(): string {
    return this._receiptNumber;
  }
  get paymentId(): string {
    return this._paymentId;
  }
  get customerId(): string | undefined {
    return this._customerId;
  }
  get storeId(): string {
    return this._storeId;
  }
  get payerName(): string | undefined {
    return this._payerName;
  }
  get payerDocument(): string | undefined {
    return this._payerDocument;
  }
  get payerEmail(): string | undefined {
    return this._payerEmail;
  }
  get payeeName(): string {
    return this._payeeName;
  }
  get payeeDocument(): string | undefined {
    return this._payeeDocument;
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
  get status(): ReceiptStatus {
    return this._status;
  }
  get issuedAt(): Date {
    return this._issuedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  isIssued(): boolean {
    return this._status === ReceiptStatus.ISSUED;
  }

  isCancelled(): boolean {
    return this._status === ReceiptStatus.CANCELLED;
  }

  cancel(): void {
    if (this._status === ReceiptStatus.CANCELLED) {
      throw new ReceiptAlreadyCancelledError();
    }
    this._status = ReceiptStatus.CANCELLED;
    this._updatedAt = new Date();
  }

  toObject(): ReceiptObject {
    return {
      id: this._id,
      receiptNumber: this._receiptNumber,
      paymentId: this._paymentId,
      customerId: this._customerId,
      storeId: this._storeId,
      payerName: this._payerName,
      payerDocument: this._payerDocument,
      payerEmail: this._payerEmail,
      payeeName: this._payeeName,
      payeeDocument: this._payeeDocument,
      amount: this._amount,
      fee: this._fee,
      netAmount: this._netAmount,
      currency: this._currency,
      description: this._description,
      status: this._status,
      issuedAt: this._issuedAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

export enum ReceiptStatus {
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}

export interface CreateReceiptProps {
  receiptNumber: string;
  paymentId: string;
  customerId?: string;
  storeId: string;
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
  payeeName: string;
  payeeDocument?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency?: string;
  description?: string;
}

export interface ReceiptProps {
  id: string;
  receiptNumber: string;
  paymentId: string;
  customerId?: string;
  storeId: string;
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
  payeeName: string;
  payeeDocument?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description?: string;
  status: ReceiptStatus;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReceiptObject {
  id: string;
  receiptNumber: string;
  paymentId: string;
  customerId?: string;
  storeId: string;
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
  payeeName: string;
  payeeDocument?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description?: string;
  status: ReceiptStatus;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  items?: LineItemObject[];
}
