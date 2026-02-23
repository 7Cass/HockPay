/**
 * OutboxEvent Status Enum
 */
export enum OutboxEventStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

/**
 * Domain Entity: OutboxEvent
 *
 * Represents an event in the outbox pattern for reliable event delivery.
 * Used for webhook notifications and other async operations.
 */
export class OutboxEvent {
  private readonly _id: string;
  private readonly _aggregateType: string;
  private readonly _aggregateId: string;
  private readonly _eventType: string;
  private readonly _payload: Record<string, unknown>;
  private _status: OutboxEventStatus;
  private _processedAt?: Date;
  private _retryCount: number;
  private readonly _maxRetries: number;
  private _nextRetryAt?: Date;
  private _errorMessage?: string;
  private readonly _createdAt: Date;

  private constructor(props: OutboxEventProps) {
    this._id = props.id;
    this._aggregateType = props.aggregateType;
    this._aggregateId = props.aggregateId;
    this._eventType = props.eventType;
    this._payload = props.payload;
    this._status = props.status;
    this._processedAt = props.processedAt;
    this._retryCount = props.retryCount;
    this._maxRetries = props.maxRetries;
    this._nextRetryAt = props.nextRetryAt;
    this._errorMessage = props.errorMessage;
    this._createdAt = props.createdAt;
  }

  /**
   * Factory method to create a new OutboxEvent.
   */
  static create(props: CreateOutboxEventProps): OutboxEvent {
    return new OutboxEvent({
      id: crypto.randomUUID(),
      aggregateType: props.aggregateType,
      aggregateId: props.aggregateId,
      eventType: props.eventType,
      payload: props.payload,
      status: OutboxEventStatus.PENDING,
      retryCount: 0,
      maxRetries: props.maxRetries ?? 5,
      nextRetryAt: new Date(),
      createdAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute from persistence.
   */
  static reconstitute(props: OutboxEventProps): OutboxEvent {
    return new OutboxEvent(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get aggregateType(): string {
    return this._aggregateType;
  }

  get aggregateId(): string {
    return this._aggregateId;
  }

  get eventType(): string {
    return this._eventType;
  }

  get payload(): Record<string, unknown> {
    return this._payload;
  }

  get status(): OutboxEventStatus {
    return this._status;
  }

  get processedAt(): Date | undefined {
    return this._processedAt;
  }

  get retryCount(): number {
    return this._retryCount;
  }

  get maxRetries(): number {
    return this._maxRetries;
  }

  get nextRetryAt(): Date | undefined {
    return this._nextRetryAt;
  }

  get errorMessage(): string | undefined {
    return this._errorMessage;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // Status checks

  isPending(): boolean {
    return this._status === OutboxEventStatus.PENDING;
  }

  isProcessed(): boolean {
    return this._status === OutboxEventStatus.PROCESSED;
  }

  isFailed(): boolean {
    return this._status === OutboxEventStatus.FAILED;
  }

  canRetry(): boolean {
    return this._retryCount < this._maxRetries;
  }

  isReadyForRetry(): boolean {
    return this.isPending() && (!this._nextRetryAt || this._nextRetryAt <= new Date());
  }

  // Business methods

  /**
   * Mark the event as processed.
   */
  markAsProcessed(): void {
    this._status = OutboxEventStatus.PROCESSED;
    this._processedAt = new Date();
    this._errorMessage = undefined;
  }

  /**
   * Mark the event as failed and schedule retry.
   */
  markAsFailed(error: string): void {
    this._retryCount++;

    if (this.canRetry()) {
      this._status = OutboxEventStatus.PENDING;
      this._nextRetryAt = this.calculateNextRetry();
    } else {
      this._status = OutboxEventStatus.FAILED;
      this._nextRetryAt = undefined;
    }

    this._errorMessage = error;
  }

  /**
   * Calculate next retry time with exponential backoff.
   * Delays: immediate, 1min, 5min, 30min, 2h
   */
  private calculateNextRetry(): Date {
    const delays = [0, 60, 300, 1800, 7200]; // in seconds
    const index = Math.min(this._retryCount, delays.length - 1);
    const delaySeconds = delays[index];
    return new Date(Date.now() + delaySeconds * 1000);
  }

  /**
   * Convert to plain object.
   */
  toObject(): OutboxEventObject {
    return {
      id: this._id,
      aggregateType: this._aggregateType,
      aggregateId: this._aggregateId,
      eventType: this._eventType,
      payload: this._payload,
      status: this._status,
      processedAt: this._processedAt,
      retryCount: this._retryCount,
      maxRetries: this._maxRetries,
      nextRetryAt: this._nextRetryAt,
      errorMessage: this._errorMessage,
      createdAt: this._createdAt,
    };
  }
}

/**
 * Properties needed to create a new OutboxEvent.
 */
export interface CreateOutboxEventProps {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  maxRetries?: number;
}

/**
 * All properties of an OutboxEvent (for reconstitution).
 */
export interface OutboxEventProps {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  processedAt?: Date;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * Simplified object representation.
 */
export interface OutboxEventObject {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  processedAt?: Date;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}
