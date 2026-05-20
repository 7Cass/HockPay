export enum WebhookDeliveryStatus {
  PENDING = "PENDING",
  DELIVERED = "DELIVERED",
  FAILED_RETRYABLE = "FAILED_RETRYABLE",
  FAILED_FINAL = "FAILED_FINAL",
}

/**
 * Domain Entity: WebhookLog
 *
 * Represents the canonical delivery row for a webhook config/outbox pair.
 * Standalone test webhook logs may still be saved without an outbox event.
 */
export class WebhookLog {
  private readonly _id: string;
  private readonly _configId: string;
  private readonly _paymentId?: string;
  private readonly _aggregateType?: string;
  private readonly _aggregateId?: string;
  private readonly _outboxEventId?: string;
  private _requestId?: string;
  private readonly _eventType: string;
  private readonly _payload: Record<string, unknown>;
  private _requestHeaders?: Record<string, string>;
  private _responseStatus?: number;
  private _responseBody?: string;
  private _status: WebhookDeliveryStatus;
  private _attempt: number;
  private readonly _maxAttempts: number;
  private _nextRetryAt?: Date;
  private _deliveredAt?: Date;
  private _failedAt?: Date;
  private _lastError?: string;
  private readonly _createdAt: Date;

  private constructor(props: WebhookLogProps) {
    this._id = props.id;
    this._configId = props.configId;
    this._paymentId = props.paymentId;
    this._aggregateType = props.aggregateType;
    this._aggregateId = props.aggregateId;
    this._outboxEventId = props.outboxEventId;
    this._requestId = props.requestId;
    this._eventType = props.eventType;
    this._payload = props.payload;
    this._requestHeaders = props.requestHeaders;
    this._responseStatus = props.responseStatus;
    this._responseBody = props.responseBody;
    this._status = props.status ?? deriveStatus(props);
    this._attempt = props.attempt;
    this._maxAttempts = props.maxAttempts;
    this._nextRetryAt = props.nextRetryAt;
    this._deliveredAt = props.deliveredAt;
    this._failedAt = props.failedAt;
    this._lastError = props.lastError;
    this._createdAt = props.createdAt;
  }

  /**
   * Factory method to create a new WebhookLog.
   */
  static create(props: CreateWebhookLogProps): WebhookLog {
    return new WebhookLog({
      id: crypto.randomUUID(),
      configId: props.configId,
      paymentId: props.paymentId,
      aggregateType: props.aggregateType,
      aggregateId: props.aggregateId,
      outboxEventId: props.outboxEventId,
      requestId: props.requestId,
      eventType: props.eventType,
      payload: props.payload,
      status: WebhookDeliveryStatus.PENDING,
      attempt: 0,
      maxAttempts: props.maxAttempts ?? 5,
      createdAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute from persistence.
   */
  static reconstitute(props: WebhookLogProps): WebhookLog {
    return new WebhookLog(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get configId(): string {
    return this._configId;
  }

  get paymentId(): string | undefined {
    return this._paymentId;
  }

  get aggregateType(): string | undefined {
    return this._aggregateType;
  }

  get aggregateId(): string | undefined {
    return this._aggregateId;
  }

  get outboxEventId(): string | undefined {
    return this._outboxEventId;
  }

  get requestId(): string | undefined {
    return this._requestId;
  }

  get eventType(): string {
    return this._eventType;
  }

  get payload(): Record<string, unknown> {
    return this._payload;
  }

  get requestHeaders(): Record<string, string> | undefined {
    return this._requestHeaders;
  }

  get responseStatus(): number | undefined {
    return this._responseStatus;
  }

  get responseBody(): string | undefined {
    return this._responseBody;
  }

  get status(): WebhookDeliveryStatus {
    return this._status;
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

  get failedAt(): Date | undefined {
    return this._failedAt;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // Status checks

  isDelivered(): boolean {
    return this._status === WebhookDeliveryStatus.DELIVERED;
  }

  canRetry(): boolean {
    return (
      this._attempt < this._maxAttempts &&
      !this.isDelivered() &&
      this._status !== WebhookDeliveryStatus.FAILED_FINAL
    );
  }

  isFinalFailure(): boolean {
    return this._status === WebhookDeliveryStatus.FAILED_FINAL;
  }

  isFailed(): boolean {
    return (
      this._status === WebhookDeliveryStatus.FAILED_RETRYABLE ||
      this._status === WebhookDeliveryStatus.FAILED_FINAL
    );
  }

  isSuccessful(): boolean {
    return (
      this._status === WebhookDeliveryStatus.DELIVERED ||
      (this._responseStatus !== undefined &&
        this._responseStatus >= 200 &&
        this._responseStatus < 300)
    );
  }

  // Business methods

  /**
   * Mark that a concrete delivery attempt is being made.
   */
  beginAttempt(requestId?: string): void {
    this._attempt++;
    this._status = WebhookDeliveryStatus.PENDING;
    this._nextRetryAt = undefined;
    this._failedAt = undefined;
    this._lastError = undefined;

    if (requestId) {
      this._requestId = requestId;
    }
  }

  /**
   * Record a successful delivery.
   */
  recordSuccess(responseStatus: number, responseBody?: string): void {
    if (this._attempt === 0) {
      this._attempt = 1;
    }
    this._responseStatus = responseStatus;
    this._responseBody = responseBody;
    this._status = WebhookDeliveryStatus.DELIVERED;
    this._deliveredAt = new Date();
    this._nextRetryAt = undefined;
    this._failedAt = undefined;
    this._lastError = undefined;
  }

  /**
   * Record a failed delivery attempt.
   */
  recordFailure(responseStatus: number, responseBody?: string): void {
    if (this._attempt === 0) {
      this._attempt = 1;
    }
    this._responseStatus = responseStatus;
    this._responseBody = responseBody;
    this._lastError = responseBody ?? `HTTP ${responseStatus}`;

    if (this._attempt < this._maxAttempts) {
      this._status = WebhookDeliveryStatus.FAILED_RETRYABLE;
      this._nextRetryAt = this.calculateNextRetry();
    } else {
      this._status = WebhookDeliveryStatus.FAILED_FINAL;
      this._nextRetryAt = undefined;
      this._failedAt = new Date();
    }
  }

  /**
   * Record that the queue exhausted all technical retries.
   */
  markFinalFailure(error: string, attemptsMade?: number): void {
    if (attemptsMade !== undefined) {
      this._attempt = Math.max(this._attempt, attemptsMade);
    } else if (this._attempt === 0) {
      this._attempt = this._maxAttempts;
    }

    this._status = WebhookDeliveryStatus.FAILED_FINAL;
    this._nextRetryAt = undefined;
    this._failedAt = new Date();
    this._lastError = error;
    this._responseBody = this._responseBody ?? error;
  }

  /**
   * Set request headers for logging.
   */
  setRequestHeaders(headers: Record<string, string>): void {
    this._requestHeaders = headers;
  }

  setRequestId(requestId: string): void {
    this._requestId = requestId;
  }

  /**
   * Calculate next retry time with exponential backoff.
   */
  private calculateNextRetry(): Date {
    // Exponential backoff: 1min, 5min, 30min, 2h
    const delays = [60, 300, 1800, 7200];
    const index = Math.min(this._attempt - 1, delays.length - 1);
    const delaySeconds = delays[index];
    return new Date(Date.now() + delaySeconds * 1000);
  }

  /**
   * Convert to plain object.
   */
  toObject(): WebhookLogObject {
    return {
      id: this._id,
      configId: this._configId,
      paymentId: this._paymentId,
      aggregateType: this._aggregateType,
      aggregateId: this._aggregateId,
      outboxEventId: this._outboxEventId,
      requestId: this._requestId,
      eventType: this._eventType,
      payload: this._payload,
      requestHeaders: this._requestHeaders,
      responseStatus: this._responseStatus,
      responseBody: this._responseBody,
      status: this._status,
      attempt: this._attempt,
      maxAttempts: this._maxAttempts,
      nextRetryAt: this._nextRetryAt,
      deliveredAt: this._deliveredAt,
      failedAt: this._failedAt,
      lastError: this._lastError,
      createdAt: this._createdAt,
    };
  }
}

/**
 * Properties needed to create a new WebhookLog.
 */
export interface CreateWebhookLogProps {
  configId: string;
  paymentId?: string;
  aggregateType?: string;
  aggregateId?: string;
  outboxEventId?: string;
  requestId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}

/**
 * All properties of a WebhookLog (for reconstitution).
 */
export interface WebhookLogProps {
  id: string;
  configId: string;
  paymentId?: string;
  aggregateType?: string;
  aggregateId?: string;
  outboxEventId?: string;
  requestId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  requestHeaders?: Record<string, string>;
  responseStatus?: number;
  responseBody?: string;
  status?: WebhookDeliveryStatus;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  lastError?: string;
  createdAt: Date;
}

/**
 * Simplified object representation.
 */
export interface WebhookLogObject {
  id: string;
  configId: string;
  paymentId?: string;
  aggregateType?: string;
  aggregateId?: string;
  outboxEventId?: string;
  requestId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  requestHeaders?: Record<string, string>;
  responseStatus?: number;
  responseBody?: string;
  status: WebhookDeliveryStatus;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  lastError?: string;
  createdAt: Date;
}

function deriveStatus(props: WebhookLogProps): WebhookDeliveryStatus {
  if (props.deliveredAt) {
    return WebhookDeliveryStatus.DELIVERED;
  }

  if (props.failedAt) {
    return WebhookDeliveryStatus.FAILED_FINAL;
  }

  if (props.responseStatus !== undefined || props.attempt > 1) {
    return WebhookDeliveryStatus.FAILED_RETRYABLE;
  }

  return WebhookDeliveryStatus.PENDING;
}
