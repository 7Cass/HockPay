import type { StoreLiveStatus } from './api-contracts';
import type { Tone } from './tone';

/**
 * O estado de habilitação LIVE da loja, explicado.
 *
 * Esta é a única tela do console onde o lojista encontra a mesa do outro lado:
 * TEST não depende de aprovação nenhuma, e LIVE passa por uma decisão humana.
 * Cada estado leva a frase que responde a pergunta seguinte — "e agora?" —,
 * porque um chip escrito "PENDING" sozinho não diz se falta alguma coisa dele
 * ou se é só esperar.
 *
 * A ressalva de que **LIVE também é simulado** está aqui de propósito, e não só
 * na landing: é no momento de pedir habilitação que alguém pode achar que vai
 * passar a mover dinheiro de verdade.
 */
const LABELS: Record<StoreLiveStatus, string> = {
  NOT_REQUESTED: 'LIVE não solicitado',
  PENDING: 'LIVE em análise',
  APPROVED: 'LIVE habilitado',
  REJECTED: 'LIVE recusado',
  SUSPENDED: 'LIVE suspenso',
};

const NOTES: Record<StoreLiveStatus, string> = {
  NOT_REQUESTED:
    'Cobrar em TEST não depende de aprovação nenhuma. LIVE passa pela mesa do HockPay — e, aqui, LIVE também é simulado.',
  PENDING: 'A mesa recebeu o pedido. TEST continua funcionando normalmente enquanto isso.',
  APPROVED:
    'A chave hk_live_ desta loja já cobra e credita o saldo LIVE — que também é simulado, com dinheiro que não existe.',
  REJECTED: 'O pedido foi recusado. Dá para pedir de novo depois de resolver o motivo abaixo.',
  SUSPENDED: 'A mesa revogou a habilitação. LIVE está fechado, e reabrir é decisão dela.',
};

const TONES: Record<StoreLiveStatus, Tone> = {
  NOT_REQUESTED: 'neutral',
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'bad',
  SUSPENDED: 'bad',
};

export function liveLabel(status: StoreLiveStatus): string {
  return LABELS[status] ?? LABELS.NOT_REQUESTED;
}

export function liveNote(status: StoreLiveStatus): string {
  return NOTES[status] ?? NOTES.NOT_REQUESTED;
}

export function liveTone(status: StoreLiveStatus): Tone {
  return TONES[status] ?? 'neutral';
}

/**
 * Quem pode pedir habilitação.
 *
 * Recusado pode pedir de novo; suspenso não — reabrir é decisão da mesa, e um
 * botão que existe para ser recusado é pior do que botão nenhum.
 */
export function canRequestLive(status: StoreLiveStatus): boolean {
  return status === 'NOT_REQUESTED' || status === 'REJECTED';
}

/** A taxa da loja, em uma linha: percentual mais fixo. */
export function feeLine(feePercent: number, feeFixed: number): string {
  const percent = feePercent.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const fixed = (feeFixed / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return `${percent}% + ${fixed}`;
}

/** `D+0` é liquidação no mesmo dia, e vale dizer isso em palavras. */
export function settlementLine(days: number): string {
  if (days <= 0) return 'No mesmo dia';
  return days === 1 ? 'Em 1 dia' : `Em ${days} dias`;
}
