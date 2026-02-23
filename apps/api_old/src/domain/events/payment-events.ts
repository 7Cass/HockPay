import { DomainEvent } from './domain-event.interface';

/**
 * Evento disparado quando um pagamento é criado
 */
export class PaymentCreatedEvent implements DomainEvent {
  readonly eventType = 'payment.created';
  readonly aggregateType = 'Payment';
  readonly version = 1;

  constructor(
    readonly aggregateId: string,
    readonly payload: {
      storeId: string;
      customerId: string;
      amountInCents: number;
      currency: string;
      expiresAt: string;
    }
  ) {
    this.occurredAt = new Date();
  }

  readonly occurredAt: Date;

  toJSON(): Record<string, unknown> {
    return {
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      payload: this.payload,
    };
  }
}

/**
 * Evento disparado quando um pagamento é confirmado
 */
export class PaymentConfirmedEvent implements DomainEvent {
  readonly eventType = 'payment.confirmed';
  readonly aggregateType = 'Payment';
  readonly version = 1;

  constructor(
    readonly aggregateId: string,
    readonly payload: {
      storeId: string;
      customerId: string;
      amountInCents: number;
      currency: string;
      pixTxId?: string;
      paidAt: string;
    }
  ) {
    this.occurredAt = new Date();
  }

  readonly occurredAt: Date;

  toJSON(): Record<string, unknown> {
    return {
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      payload: this.payload,
    };
  }
}

/**
 * Evento disparado quando um pagamento expira
 */
export class PaymentExpiredEvent implements DomainEvent {
  readonly eventType = 'payment.expired';
  readonly aggregateType = 'Payment';
  readonly version = 1;

  constructor(
    readonly aggregateId: string,
    readonly payload: {
      storeId: string;
      customerId: string;
      amountInCents: number;
      currency: string;
      expiredAt: string;
    }
  ) {
    this.occurredAt = new Date();
  }

  readonly occurredAt: Date;

  toJSON(): Record<string, unknown> {
    return {
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      payload: this.payload,
    };
  }
}

/**
 * Evento disparado quando um pagamento falha
 */
export class PaymentFailedEvent implements DomainEvent {
  readonly eventType = 'payment.failed';
  readonly aggregateType = 'Payment';
  readonly version = 1;

  constructor(
    readonly aggregateId: string,
    readonly payload: {
      storeId: string;
      customerId: string;
      amountInCents: number;
      currency: string;
      reason: string;
      failedAt: string;
    }
  ) {
    this.occurredAt = new Date();
  }

  readonly occurredAt: Date;

  toJSON(): Record<string, unknown> {
    return {
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      payload: this.payload,
    };
  }
}

/**
 * Evento disparado quando um pagamento é reembolsado
 */
export class PaymentRefundedEvent implements DomainEvent {
  readonly eventType = 'payment.refunded';
  readonly aggregateType = 'Payment';
  readonly version = 1;

  constructor(
    readonly aggregateId: string,
    readonly payload: {
      storeId: string;
      customerId: string;
      amountInCents: number;
      currency: string;
      reason?: string;
      refundedAt: string;
    }
  ) {
    this.occurredAt = new Date();
  }

  readonly occurredAt: Date;

  toJSON(): Record<string, unknown> {
    return {
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      payload: this.payload,
    };
  }
}

/**
 * Evento disparado quando o saldo de um pagamento é liberado para a conta do merchant
 */
export class PaymentReleasedEvent implements DomainEvent {
  readonly eventType = 'payment.released';
  readonly aggregateType = 'Payment';
  readonly version = 1;

  constructor(
    readonly aggregateId: string,
    readonly payload: {
      storeId: string;
      accountId: string;
      amountInCents: number;
      currency: string;
      releasedAt: string;
    }
  ) {
    this.occurredAt = new Date();
  }

  readonly occurredAt: Date;

  toJSON(): Record<string, unknown> {
    return {
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      payload: this.payload,
    };
  }
}
