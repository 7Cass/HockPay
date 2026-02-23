/**
 * Interface base para Domain Events
 *
 * Domain Events representam algo que aconteceu no domínio
 * e que outros componentes do sistema podem precisar saber.
 */

export interface DomainEvent {
  /** Tipo do evento (ex: payment.created, payment.confirmed) */
  readonly eventType: string;

  /** ID do agregado root que gerou o evento */
  readonly aggregateId: string;

  /** Tipo do agregado (ex: Payment, Merchant) */
  readonly aggregateType: string;

  /** Timestamp de quando o evento ocorreu */
  readonly occurredAt: Date;

  /** Versão do evento (para versionamento de schema) */
  readonly version: number;

  /** Dados do evento (payload serializável) */
  readonly payload: Record<string, unknown>;

  /** Converte o evento para JSON */
  toJSON(): Record<string, unknown>;
}
