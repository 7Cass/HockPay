import { DomainEvent } from '../events';

/**
 * Status do evento no outbox
 */
export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

/**
 * Entidade de Domínio: OutboxEvent
 *
 * Implementa o padrão Outbox para garantir entrega eventual de eventos.
 */
export class OutboxEvent {
  private _id: string;
  private _aggregateType: string;
  private _aggregateId: string;
  private _eventType: string;
  private _payload: Record<string, unknown>;
  private _status: OutboxStatus;
  private _processedAt: Date | null;
  private _retryCount: number;
  private _maxRetries: number;
  private _nextRetryAt: Date | null;
  private _errorMessage: string | null;
  private _createdAt: Date;

  private constructor(props: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    status: OutboxStatus;
    processedAt: Date | null;
    retryCount: number;
    maxRetries: number;
    nextRetryAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
  }) {
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

  // Getters
  get id(): string { return this._id; }
  get aggregateType(): string { return this._aggregateType; }
  get aggregateId(): string { return this._aggregateId; }
  get eventType(): string { return this._eventType; }
  get payload(): Record<string, unknown> { return { ...this._payload }; }
  get status(): OutboxStatus { return this._status; }
  get processedAt(): Date | null { return this._processedAt; }
  get retryCount(): number { return this._retryCount; }
  get maxRetries(): number { return this._maxRetries; }
  get nextRetryAt(): Date | null { return this._nextRetryAt; }
  get errorMessage(): string | null { return this._errorMessage; }
  get createdAt(): Date { return this._createdAt; }

  /**
   * Cria um novo evento no outbox a partir de um Domain Event
   */
  static fromDomainEvent(
    id: string,
    event: DomainEvent,
    maxRetries: number = 5
  ): OutboxEvent {
    return new OutboxEvent({
      id,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.toJSON(),
      status: OutboxStatus.PENDING,
      processedAt: null,
      retryCount: 0,
      maxRetries,
      nextRetryAt: new Date(),
      errorMessage: null,
      createdAt: event.occurredAt,
    });
  }

  /**
   * Recria uma instância de OutboxEvent a partir de dados persistidos
   */
  static fromPersistence(props: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    status: OutboxStatus;
    processedAt: Date | null;
    retryCount: number;
    maxRetries: number;
    nextRetryAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
  }): OutboxEvent {
    return new OutboxEvent(props);
  }

  /**
   * Marca o evento como processado com sucesso
   */
  markAsProcessed(): void {
    if (this._status === OutboxStatus.PROCESSED) {
      return;
    }
    this._status = OutboxStatus.PROCESSED;
    this._processedAt = new Date();
    this._nextRetryAt = null;
    this._errorMessage = null;
  }

  /**
   * Marca o evento como falha e agenda retry
   */
  markAsFailed(errorMessage: string, nextRetryAt: Date): void {
    this._status = OutboxStatus.FAILED;
    this._errorMessage = errorMessage;
    this._retryCount += 1;
    this._nextRetryAt = nextRetryAt;
  }

  /**
   * Marca para processamento imediato
   */
  markForRetry(): void {
    if (this._status === OutboxStatus.PROCESSED) {
      return;
    }
    this._status = OutboxStatus.PENDING;
    this._nextRetryAt = new Date();
  }

  /**
   * Verifica se o evento está pendente e pode ser processado
   */
  isPending(now: Date = new Date()): boolean {
    if (this._status !== OutboxStatus.PENDING) {
      return false;
    }

    if (this._nextRetryAt && this._nextRetryAt > now) {
      return false;
    }

    return true;
  }

  /**
   * Verifica se foi processado com sucesso
   */
  isProcessed(): boolean {
    return this._status === OutboxStatus.PROCESSED;
  }

  /**
   * Verifica se esgotou as tentativas
   */
  isExhausted(): boolean {
    return this._retryCount >= this._maxRetries;
  }

  /**
   * Calcula o próximo momento de retry (exponential backoff)
   */
  static calculateNextRetry(retryCount: number): Date {
    // Exponential backoff: imediato, 1min, 5min, 30min, 2h
    const delays = [0, 1, 5, 30, 120]; // em minutos
    const index = Math.min(retryCount, delays.length - 1);
    const delayMinutes = delays[index];
    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  /**
   * Retorna os dados prontos para persistência
   */
  toPersistence(): {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    status: string;
    processedAt: Date | null;
    retryCount: number;
    maxRetries: number;
    nextRetryAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
  } {
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
