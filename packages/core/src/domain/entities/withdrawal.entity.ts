import { InvalidWithdrawalStatusError } from "../errors/invalid-withdrawal-status.error";

export enum WithdrawalStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export class Withdrawal {
  private readonly _id: string;
  private readonly _accountId: string;
  private readonly _bankAccountId: string;
  private readonly _amount: number;
  private readonly _fee: number;
  private readonly _netAmount: number;
  private _status: WithdrawalStatus;
  private _pixE2eId?: string;
  private _paidAt?: Date;
  private _failedReason?: string;
  private _processingAttempts: number;
  private _nextProcessAt?: Date;
  private _lastProcessingError?: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: WithdrawalProps) {
    this._id = props.id;
    this._accountId = props.accountId;
    this._bankAccountId = props.bankAccountId;
    this._amount = props.amount;
    this._fee = props.fee;
    this._netAmount = props.netAmount;
    this._status = props.status;
    this._pixE2eId = props.pixE2eId;
    this._paidAt = props.paidAt;
    this._failedReason = props.failedReason;
    this._processingAttempts = props.processingAttempts ?? 0;
    this._nextProcessAt = props.nextProcessAt;
    this._lastProcessingError = props.lastProcessingError;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateWithdrawalProps): Withdrawal {
    return new Withdrawal({
      id: crypto.randomUUID(),
      accountId: props.accountId,
      bankAccountId: props.bankAccountId,
      amount: props.amount,
      fee: props.fee,
      netAmount: props.amount - props.fee,
      status: WithdrawalStatus.PENDING,
      processingAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: WithdrawalProps): Withdrawal {
    return new Withdrawal(props);
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get bankAccountId(): string {
    return this._bankAccountId;
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

  get status(): WithdrawalStatus {
    return this._status;
  }

  get pixE2eId(): string | undefined {
    return this._pixE2eId;
  }

  get paidAt(): Date | undefined {
    return this._paidAt;
  }

  get failedReason(): string | undefined {
    return this._failedReason;
  }

  get processingAttempts(): number {
    return this._processingAttempts;
  }

  get nextProcessAt(): Date | undefined {
    return this._nextProcessAt;
  }

  get lastProcessingError(): string | undefined {
    return this._lastProcessingError;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isPending(): boolean {
    return this._status === WithdrawalStatus.PENDING;
  }

  isProcessing(): boolean {
    return this._status === WithdrawalStatus.PROCESSING;
  }

  isTerminal(): boolean {
    return (
      this._status === WithdrawalStatus.COMPLETED ||
      this._status === WithdrawalStatus.FAILED
    );
  }

  markProcessing(): void {
    if (!this.isPending()) {
      throw new InvalidWithdrawalStatusError(
        "Withdrawal must be pending to start processing",
      );
    }

    this._status = WithdrawalStatus.PROCESSING;
    this._processingAttempts += 1;
    this._nextProcessAt = undefined;
    this._lastProcessingError = undefined;
    this.touch();
  }

  recordRetry(error: string, nextProcessAt: Date): void {
    if (!this.isProcessing()) {
      throw new InvalidWithdrawalStatusError(
        "Withdrawal must be processing to schedule a retry",
      );
    }

    this._status = WithdrawalStatus.PENDING;
    this._lastProcessingError = error;
    this._nextProcessAt = nextProcessAt;
    this.touch();
  }

  complete(props?: { pixE2eId?: string; paidAt?: Date }): void {
    if (this.isTerminal()) {
      throw new InvalidWithdrawalStatusError(
        "Withdrawal is already terminal",
      );
    }

    this._status = WithdrawalStatus.COMPLETED;
    this._pixE2eId =
      props?.pixE2eId ?? `E2E${crypto.randomUUID().replace(/-/g, "")}`;
    this._paidAt = props?.paidAt ?? new Date();
    this._failedReason = undefined;
    this._nextProcessAt = undefined;
    this._lastProcessingError = undefined;
    this.touch();
  }

  fail(reason: string): void {
    if (this.isTerminal()) {
      throw new InvalidWithdrawalStatusError(
        "Withdrawal is already terminal",
      );
    }

    this._status = WithdrawalStatus.FAILED;
    this._failedReason = reason;
    this._nextProcessAt = undefined;
    this._lastProcessingError = undefined;
    this.touch();
  }

  toObject(): WithdrawalObject {
    return {
      id: this._id,
      accountId: this._accountId,
      bankAccountId: this._bankAccountId,
      amount: this._amount,
      fee: this._fee,
      netAmount: this._netAmount,
      status: this._status,
      pixE2eId: this._pixE2eId,
      paidAt: this._paidAt,
      failedReason: this._failedReason,
      processingAttempts: this._processingAttempts,
      nextProcessAt: this._nextProcessAt,
      lastProcessingError: this._lastProcessingError,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  private touch(): void {
    this._updatedAt = new Date();
  }
}

export interface CreateWithdrawalProps {
  accountId: string;
  bankAccountId: string;
  amount: number;
  fee: number;
}

export interface WithdrawalProps {
  id: string;
  accountId: string;
  bankAccountId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: WithdrawalStatus;
  pixE2eId?: string;
  paidAt?: Date;
  failedReason?: string;
  processingAttempts?: number;
  nextProcessAt?: Date;
  lastProcessingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WithdrawalObject extends WithdrawalProps {
  processingAttempts: number;
}
