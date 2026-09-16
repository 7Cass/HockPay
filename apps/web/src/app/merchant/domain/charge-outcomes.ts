import type { Tone } from './tone';

/**
 * Os desfechos que o lojista pode forçar numa cobrança, e quando.
 *
 * A promessa da landing é "escolha o final": confirmar, falhar, expirar. O
 * dashboard antigo nunca entregou isso — `POST /dev/simulate/:id/*` existe na
 * API desde sempre e não tem **uma** chamada no front. Este arquivo é a regra
 * de quando cada ação faz sentido, e é regra pura: a tela pergunta, e a API
 * continua sendo quem decide.
 *
 * A ordem importa. `PENDING` oferece os três finais de uma cobrança viva;
 * `CONFIRMED` oferece só a liberação, que é o que o settlement faria sozinho
 * em D+30. Estado morto não oferece nada — e a tela some com o painel em vez
 * de mostrar botão desligado, porque botão desligado convida ao clique.
 */
export type OutcomeAction = 'confirm' | 'fail' | 'expire' | 'release';

export interface Outcome {
  readonly action: OutcomeAction;
  readonly label: string;
  /** O que acontece, em uma frase, para o segundo passo da confirmação. */
  readonly effect: string;
  readonly tone: Tone;
}

const OUTCOMES: Readonly<Record<OutcomeAction, Outcome>> = {
  confirm: {
    action: 'confirm',
    label: 'Confirmar',
    effect:
      'O pagamento passa a confirmado, o comprovante é emitido e o líquido entra no saldo a receber.',
    tone: 'ok',
  },
  release: {
    action: 'release',
    label: 'Liberar',
    effect:
      'O líquido sai do saldo a receber e entra no disponível — é o que a liquidação faria em D+30.',
    tone: 'ok',
  },
  fail: {
    action: 'fail',
    label: 'Falhar',
    effect: 'A cobrança passa a falha, com o motivo registrado. Nenhum lançamento é criado.',
    tone: 'bad',
  },
  expire: {
    action: 'expire',
    label: 'Expirar',
    effect: 'A cobrança vence sem confirmação, como se o prazo do Pix tivesse passado.',
    tone: 'warn',
  },
};

/** O que dá para forçar num pagamento com este status. Vazio = nada a fazer. */
export function outcomesFor(status: string): readonly Outcome[] {
  switch (status?.toUpperCase()) {
    case 'PENDING':
      return [OUTCOMES.confirm, OUTCOMES.fail, OUTCOMES.expire];
    case 'CONFIRMED':
      return [OUTCOMES.release];
    default:
      return [];
  }
}

/** O motivo padrão de uma falha forçada, quando o lojista não escreve um. */
export const DEFAULT_FAIL_REASON = 'Falha simulada pelo console';

/**
 * O tom de um link de pagamento.
 *
 * `ACTIVE` sai do vocabulário geral de propósito: um produto ativo está de pé,
 * mas um link ativo é só uma cobrança à espera de alguém — não é vitória
 * nenhuma até virar `PAID`.
 */
const LINK_TONES: Readonly<Record<string, Tone>> = {
  ACTIVE: 'neutral',
  OPENED: 'warn',
  PAID: 'ok',
  EXPIRED: 'bad',
  CANCELLED: 'bad',
};

export function linkTone(status: string): Tone | undefined {
  return LINK_TONES[status?.toUpperCase() ?? ''];
}

/** Estados em que a cobrança já morreu — nada mais entra por ela. */
const TERMINAL_LINK = ['PAID', 'EXPIRED', 'CANCELLED'];

export function isLinkTerminal(status: string): boolean {
  return TERMINAL_LINK.includes(status?.toUpperCase() ?? '');
}

/**
 * Simular pela tentativa do link exige duas coisas: o link vivo e a PixCharge
 * aberta. A segunda é o que o dashboard antigo já checava, e some do olho de
 * quem lê só o status do link.
 */
export function canSimulateLink(status: string, chargeStatus: string): boolean {
  return !isLinkTerminal(status) && chargeStatus?.toUpperCase() === 'OPEN';
}

/** Por que a simulação do link está indisponível — a tela diz, em vez de sumir. */
export function linkSimulationBlocker(status: string, chargeStatus: string): string | null {
  if (isLinkTerminal(status)) return 'Link pago, expirado ou cancelado não aceita nova tentativa.';
  if (chargeStatus?.toUpperCase() !== 'OPEN') return 'A cobrança Pix deste link não está aberta.';
  return null;
}

/** Quanto ainda dá para estornar de um pagamento. */
export function refundableAmount(amount: number, totalRefunded = 0): number {
  return Math.max(amount - totalRefunded, 0);
}

/**
 * O que impede este estorno, ou `null` quando nada impede.
 *
 * Estorno parcial **não** muda o status do pagamento — ele segue `CONFIRMED`
 * ou `RELEASED` até o estornado cobrir o total. Por isso a pergunta é sobre o
 * estornável restante, e não sobre o status.
 */
export function refundBlocker(input: {
  status: string;
  amount: number;
  totalRefunded?: number;
  requested: number;
}): string | null {
  const status = input.status?.toUpperCase();
  const remaining = refundableAmount(input.amount, input.totalRefunded);

  if (status !== 'CONFIRMED' && status !== 'RELEASED') {
    return 'Só cobrança confirmada ou liquidada pode ser estornada.';
  }
  if (remaining <= 0) return 'Esta cobrança já foi estornada por inteiro.';
  if (input.requested < 1) return 'Informe um valor maior que zero.';
  if (input.requested > remaining) return 'O valor passa do que ainda dá para estornar.';

  return null;
}
