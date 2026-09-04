/**
 * Catalogo canonico de eventos publicos.
 *
 * Esta e a unica fonte de verdade sobre quais eventos existem, em que versao
 * o envelope de cada um esta congelado e o que cada um significa. Derivam
 * daqui, e nao de listas paralelas:
 *
 * - `ALLOWED_WEBHOOK_EVENTS` / `ALLOWED_ALERT_EVENTS` (a que o lojista assina)
 * - a `version` gravada em cada `OutboxEvent` na producao do evento
 * - `docs/EVENTS.md`, gerado por `pnpm docs:events`
 *
 * O efeito pratico e que um tipo novo nao consegue chegar em producao sem
 * versao e sem catalogo: se nao esta aqui, `assertKnownEventType` derruba a
 * emissao no teste, e o doc drift test derruba a CI.
 */

/**
 * `subscribable`: evento de dominio. Nasce no outbox, e entregue pelo worker e
 * chega no endpoint dentro do envelope versionado.
 *
 * `manual`: disparo de teste. Nao passa pelo outbox, so acontece quando o
 * lojista pede, e hoje **nao** usa o envelope — vai um corpo proprio, mais
 * simples. Esta catalogado porque chega na mesma URL e portanto e contrato.
 */
export type EventDelivery = 'subscribable' | 'manual';

export interface EventDefinition {
  /**
   * Versao do envelope deste tipo. Sobe quando a forma de `data` muda de um
   * jeito que quebra quem ja consome. Campo novo e opcional nao sobe versao.
   */
  readonly version: number;
  /** Agregado de origem, o mesmo gravado em `OutboxEvent.aggregateType`. */
  readonly aggregateType: string;
  /** Uma linha, na voz do integrador: o que aconteceu no mundo. */
  readonly summary: string;
  /** Em que ponto exato do fluxo o evento e produzido. */
  readonly emittedWhen: string;
  readonly delivery: EventDelivery;
}

export const EVENT_CATALOG = {
  'payment.created': {
    version: 1,
    aggregateType: 'Payment',
    summary: 'Uma cobranca Pix foi criada e o QR code ja pode ser apresentado ao pagador.',
    emittedWhen: 'Na criacao do pagamento, seja por API, checkout session ou Payment Link.',
    delivery: 'subscribable',
  },
  'payment.confirmed': {
    version: 1,
    aggregateType: 'Payment',
    summary: 'O pagamento foi confirmado e o valor liquido entrou no saldo pendente da loja.',
    emittedWhen: 'Na liquidacao da cobranca, junto da emissao do recibo e do lancamento no ledger.',
    delivery: 'subscribable',
  },
  'payment.failed': {
    version: 1,
    aggregateType: 'Payment',
    summary: 'Uma tentativa de pagamento falhou. A cobranca segue aberta para nova tentativa.',
    emittedWhen: 'Quando a tentativa e marcada como falha, por simulacao TEST ou por recusa.',
    delivery: 'subscribable',
  },
  'payment.expired': {
    version: 1,
    aggregateType: 'Payment',
    summary: 'A cobranca expirou sem pagamento e nao aceita mais tentativas.',
    emittedWhen: 'Pelo job de expiracao no worker, ou pelo endpoint TEST de simulacao.',
    delivery: 'subscribable',
  },
  'payment.released': {
    version: 1,
    aggregateType: 'Payment',
    summary: 'O valor saiu do saldo pendente e virou saldo disponivel para saque.',
    emittedWhen: 'Na liberacao do repasse, apos o periodo de retencao.',
    delivery: 'subscribable',
  },
  'payment.refunded': {
    version: 1,
    aggregateType: 'Payment',
    summary: 'O pagamento foi estornado, total ou parcialmente.',
    emittedWhen: 'Na conclusao do estorno, com o lancamento de debito ja no ledger.',
    delivery: 'subscribable',
  },

  'payment_link.created': {
    version: 1,
    aggregateType: 'PaymentLink',
    summary: 'Um Payment Link foi criado e ja pode ser compartilhado.',
    emittedWhen:
      'Na criacao do link, por API ou pelo dashboard — util para quem cria links fora do proprio backend.',
    delivery: 'subscribable',
  },
  'payment_link.paid': {
    version: 1,
    aggregateType: 'PaymentLink',
    summary: 'Um Payment Link foi pago e esta fechado.',
    emittedWhen:
      'Na liquidacao da tentativa que confirmou o link, logo apos o `payment.confirmed` correspondente.',
    delivery: 'subscribable',
  },
  'payment_link.expired': {
    version: 1,
    aggregateType: 'PaymentLink',
    summary: 'Um Payment Link expirou sem ser pago.',
    emittedWhen:
      'Quando a cobranca por tras do link expira, pelo job de expiracao ou por simulacao TEST.',
    delivery: 'subscribable',
  },
  'payment_link.cancelled': {
    version: 1,
    aggregateType: 'PaymentLink',
    summary: 'Um Payment Link foi cancelado pelo lojista antes de ser pago.',
    emittedWhen: 'No cancelamento do link, que tambem cancela a cobranca aberta.',
    delivery: 'subscribable',
  },

  'withdrawal.created': {
    version: 1,
    aggregateType: 'Withdrawal',
    summary: 'Um saque foi solicitado e o valor ficou reservado no saldo da loja.',
    emittedWhen: 'Na criacao do saque, com a reserva de saldo ja aplicada.',
    delivery: 'subscribable',
  },
  'withdrawal.processing': {
    version: 1,
    aggregateType: 'Withdrawal',
    summary: 'O saque entrou em processamento.',
    emittedWhen: 'Quando o worker assume o saque para processar.',
    delivery: 'subscribable',
  },
  'withdrawal.completed': {
    version: 1,
    aggregateType: 'Withdrawal',
    summary: 'O saque foi concluido e o valor saiu do saldo da loja.',
    emittedWhen: 'Na conclusao do saque simulado, com o debito lancado no ledger.',
    delivery: 'subscribable',
  },
  'withdrawal.failed': {
    version: 1,
    aggregateType: 'Withdrawal',
    summary: 'O saque falhou e o valor reservado voltou para o saldo disponivel.',
    emittedWhen: 'Na falha do processamento, apos a devolucao da reserva.',
    delivery: 'subscribable',
  },

  'webhook.test': {
    version: 1,
    aggregateType: 'WebhookConfig',
    summary: 'Disparo de teste para o lojista validar assinatura e endpoint.',
    emittedWhen:
      'Somente quando o lojista pede um teste no dashboard ou pela API. Nao passa pelo outbox e nao carrega o envelope.',
    delivery: 'manual',
  },
  'alert.test': {
    version: 1,
    aggregateType: 'AlertConfig',
    summary: 'Disparo de teste para o lojista validar um canal de alerta.',
    emittedWhen:
      'Somente quando o lojista pede um teste de alerta. Vai pelo canal do alerta (Discord), nao por webhook.',
    delivery: 'manual',
  },
} as const satisfies Record<string, EventDefinition>;

/** Todo tipo de evento que o sistema sabe produzir, assinavel ou nao. */
export type PublicEventType = keyof typeof EVENT_CATALOG;

export const ALL_EVENT_TYPES = Object.keys(EVENT_CATALOG) as PublicEventType[];

export function isKnownEventType(eventType: string): eventType is PublicEventType {
  return Object.prototype.hasOwnProperty.call(EVENT_CATALOG, eventType);
}

export function getEventDefinition(eventType: PublicEventType): EventDefinition {
  return EVENT_CATALOG[eventType];
}

/**
 * Versao do envelope para um tipo. Tipos desconhecidos caem em 1 em vez de
 * explodir: um evento antigo, gravado antes de o catalogo existir, ainda
 * precisa poder ser reentregue a partir da DLQ.
 */
export function eventContractVersion(eventType: string): number {
  return isKnownEventType(eventType) ? EVENT_CATALOG[eventType].version : 1;
}

/**
 * Guarda para o caminho de producao: emitir um tipo fora do catalogo e bug de
 * programacao, nao entrada de usuario.
 */
export function assertKnownEventType(eventType: string): asserts eventType is PublicEventType {
  if (!isKnownEventType(eventType)) {
    throw new Error(
      `Unknown event type "${eventType}". Add it to EVENT_CATALOG before emitting it.`,
    );
  }
}
