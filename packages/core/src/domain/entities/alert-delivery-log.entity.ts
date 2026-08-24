import { AlertChannel } from './alert-config.entity';

export enum AlertDeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

/**
 * Domain Entity: AlertDeliveryLog
 *
 * Tracks delivery attempts for operational alerts.
 */
export class AlertDeliveryLog {
  private readonly _id: string;
  private readonly _alertConfigId: string;
  private readonly _outboxEventId: string;
  private readonly _paymentId?: string;
  private readonly _eventType: string;
  private readonly _channel: AlertChannel;
  private _status: AlertDeliveryStatus;
  private readonly _payload: Record<string, unknown>;
  private _responseStatus?: number;
  private _responseBody?: string;
  private _errorMessage?: string;
  private _attempt: number;
  private readonly _maxAttempts: number;
  private _nextRetryAt?: Date;
  private _deliveredAt?: Date;
  private readonly _createdAt: Date;

  private constructor(props: AlertDeliveryLogProps) {
    this._id = props.id;
    this._alertConfigId = props.alertConfigId;
    this._outboxEventId = props.outboxEventId;
    this._paymentId = props.paymentId;
    this._eventType = props.eventType;
    this._channel = props.channel;
    this._status = props.status;
    this._payload = props.payload;
    this._responseStatus = props.responseStatus;
    this._responseBody = props.responseBody;
    this._errorMessage = props.errorMessage;
    this._attempt = props.attempt;
    this._maxAttempts = props.maxAttempts;
    this._nextRetryAt = props.nextRetryAt;
    this._deliveredAt = props.deliveredAt;
    this._createdAt = props.createdAt;
  }

  static create(props: CreateAlertDeliveryLogProps): AlertDeliveryLog {
    return new AlertDeliveryLog({
      id: crypto.randomUUID(),
      alertConfigId: props.alertConfigId,
      outboxEventId: props.outboxEventId,
      paymentId: props.paymentId,
      eventType: props.eventType,
      channel: props.channel,
      status: AlertDeliveryStatus.PENDING,
      payload: props.payload,
      attempt: 1,
      maxAttempts: props.maxAttempts ?? 5,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: AlertDeliveryLogProps): AlertDeliveryLog {
    return new AlertDeliveryLog(props);
  }

  get id(): string {
    return this._id;
  }

  get alertConfigId(): string {
    return this._alertConfigId;
  }

  get outboxEventId(): string {
    return this._outboxEventId;
  }

  get paymentId(): string | undefined {
    return this._paymentId;
  }

  get eventType(): string {
    return this._eventType;
  }

  get channel(): AlertChannel {
    return this._channel;
  }

  get status(): AlertDeliveryStatus {
    return this._status;
  }

  get payload(): Record<string, unknown> {
    return this._payload;
  }

  get responseStatus(): number | undefined {
    return this._responseStatus;
  }

  get responseBody(): string | undefined {
    return this._responseBody;
  }

  get errorMessage(): string | undefined {
    return this._errorMessage;
  }

  get attempt(): number {
    return this._attempt;
  }

  get maxAttempts(): number {
    return this._maxAttempts;
  }

  get nextRetryAt(): Date | undefined {
    return this._nextRetryAt;
  }

  get deliveredAt(): Date | undefined {
    return this._deliveredAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  isDelivered(): boolean {
    return this._status === AlertDeliveryStatus.DELIVERED;
  }

  canRetry(): boolean {
    return !this.isDelivered() && this._attempt < this._maxAttempts;
  }

  recordSuccess(responseStatus: number, responseBody?: string): void {
    this._status = AlertDeliveryStatus.DELIVERED;
    this._responseStatus = responseStatus;
    this._responseBody = responseBody;
    this._errorMessage = undefined;
    this._nextRetryAt = undefined;
    this._deliveredAt = new Date();
  }

  recordFailure(
    responseStatus: number,
    responseBody?: string,
    errorMessage?: string,
    retryAfterSeconds?: number,
  ): void {
    this._status = AlertDeliveryStatus.FAILED;
    this._responseStatus = responseStatus;
    this._responseBody = responseBody;
    this._errorMessage = errorMessage;
    this._nextRetryAt = this.canRetry() ? this.calculateNextRetry(retryAfterSeconds) : undefined;
  }

  markRetryAttempt(): void {
    if (this.canRetry()) {
      this._attempt++;
      this._status = AlertDeliveryStatus.PENDING;
      this._nextRetryAt = undefined;
    }
  }

  private calculateNextRetry(retryAfterSeconds?: number): Date {
    if (retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds)) {
      return new Date(Date.now() + Math.max(retryAfterSeconds, 1) * 1000);
    }

    const delays = [60, 300, 1800, 7200];
    const index = Math.min(this._attempt - 1, delays.length - 1);
    return new Date(Date.now() + delays[index] * 1000);
  }

  toObject(): AlertDeliveryLogObject {
    return {
      id: this._id,
      alertConfigId: this._alertConfigId,
      outboxEventId: this._outboxEventId,
      paymentId: this._paymentId,
      eventType: this._eventType,
      channel: this._channel,
      status: this._status,
      payload: this._payload,
      responseStatus: this._responseStatus,
      responseBody: this._responseBody,
      errorMessage: this._errorMessage,
      attempt: this._attempt,
      maxAttempts: this._maxAttempts,
      nextRetryAt: this._nextRetryAt,
      deliveredAt: this._deliveredAt,
      createdAt: this._createdAt,
    };
  }
}

export interface CreateAlertDeliveryLogProps {
  alertConfigId: string;
  outboxEventId: string;
  paymentId?: string;
  eventType: string;
  channel: AlertChannel;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}

export interface AlertDeliveryLogProps extends CreateAlertDeliveryLogProps {
  id: string;
  status: AlertDeliveryStatus;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

export type AlertDeliveryLogObject = AlertDeliveryLogProps;
