/**
 * Os eventos que o lojista pode assinar, na voz dele.
 *
 * Isto é um **espelho** do catálogo de `packages/core`, e é espelho de
 * propósito: o console não importa de fora da pasta (só a costura importa), e
 * o catálogo carrega resumo escrito para quem integra por HTTP — "o valor
 * liquido entrou no saldo pendente da loja" —, não para quem está escolhendo
 * numa lista o que quer receber.
 *
 * Espelho custa defasagem: a tela antiga oferecia cinco eventos enquanto a API
 * já aceitava dez, e ninguém percebeu porque nada comparava as duas listas.
 * Aqui `webhook-events.spec.ts` lê o catálogo **no disco** e falha quando os
 * conjuntos divergirem. O espelho continua existindo; o que deixa de existir é
 * a possibilidade de ele envelhecer em silêncio.
 *
 * Um evento novo em `packages/core` quebra o teste com o nome dele na mensagem.
 * O conserto é uma linha aqui — e essa linha é justamente a tradução que o
 * catálogo não tem.
 */
export interface EventOption {
  readonly value: string;
  readonly label: string;
  /** O que o lojista ganha assinando — não o que o sistema faz. */
  readonly hint: string;
}

export interface EventGroup {
  readonly label: string;
  readonly options: readonly EventOption[];
}

export const EVENT_GROUPS: readonly EventGroup[] = [
  {
    label: 'Pagamentos',
    options: [
      {
        value: 'payment.created',
        label: 'Cobrança criada',
        hint: 'O QR code nasceu e já pode ser mostrado ao pagador.',
      },
      {
        value: 'payment.confirmed',
        label: 'Pagamento confirmado',
        hint: 'O dinheiro entrou. É aqui que se libera o pedido.',
      },
      {
        value: 'payment.failed',
        label: 'Tentativa falhou',
        hint: 'Uma tentativa não passou; a cobrança segue aberta.',
      },
      {
        value: 'payment.expired',
        label: 'Cobrança expirou',
        hint: 'O prazo acabou sem pagamento e não aceita mais tentativa.',
      },
      {
        value: 'payment.released',
        label: 'Valor liberado',
        hint: 'Saiu do saldo a liberar e virou saldo disponível para saque.',
      },
      {
        value: 'payment.refunded',
        label: 'Pagamento estornado',
        hint: 'Devolução total ou parcial de um pagamento confirmado.',
      },
    ],
  },
  {
    label: 'Links de pagamento',
    options: [
      {
        value: 'payment_link.created',
        label: 'Link criado',
        hint: 'Um link novo já pode ser compartilhado.',
      },
      {
        value: 'payment_link.paid',
        label: 'Link pago',
        hint: 'O link foi pago e está fechado.',
      },
      {
        value: 'payment_link.expired',
        label: 'Link expirou',
        hint: 'O link venceu sem ser pago.',
      },
      {
        value: 'payment_link.cancelled',
        label: 'Link cancelado',
        hint: 'Você cancelou o link antes de ele ser pago.',
      },
    ],
  },
  {
    label: 'Saques',
    options: [
      {
        value: 'withdrawal.created',
        label: 'Saque solicitado',
        hint: 'O valor ficou reservado no saldo da loja.',
      },
      {
        value: 'withdrawal.processing',
        label: 'Saque em processamento',
        hint: 'O saque saiu da fila e está sendo executado.',
      },
      {
        value: 'withdrawal.completed',
        label: 'Saque concluído',
        hint: 'O valor saiu da loja e chegou na chave Pix.',
      },
      {
        value: 'withdrawal.failed',
        label: 'Saque falhou',
        hint: 'O valor reservado voltou para o saldo disponível.',
      },
    ],
  },
];

/** Todo evento assinável, sem os grupos. */
export const SUBSCRIBABLE_EVENTS: readonly string[] = EVENT_GROUPS.flatMap((group) =>
  group.options.map((option) => option.value),
);

const BY_VALUE = new Map(
  EVENT_GROUPS.flatMap((group) => group.options).map((option) => [option.value, option]),
);

/**
 * O rótulo de um evento. Desconhecido devolve o próprio tipo.
 *
 * Isso importa nos **logs**: uma entrega antiga pode carregar um tipo que já
 * saiu do catálogo, e um histórico que mostra `payment.legacy` conta mais do
 * que um que mostra "—".
 */
export function eventLabel(value: string): string {
  return BY_VALUE.get(value)?.label ?? value;
}

export function eventHint(value: string): string | undefined {
  return BY_VALUE.get(value)?.hint;
}

/** O que dizer no lugar de uma lista longa de eventos assinados. */
export function eventSummary(events: readonly string[]): string {
  if (events.length === 0) return 'Nenhum evento';
  if (events.length === SUBSCRIBABLE_EVENTS.length) return 'Todos os eventos';
  if (events.length === 1) return eventLabel(events[0]);
  return `${eventLabel(events[0])} +${events.length - 1}`;
}
