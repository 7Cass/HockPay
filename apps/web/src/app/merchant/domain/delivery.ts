import type { Tone } from './tone';

/**
 * O desfecho de uma entrega — inclusive quando a API não o manda.
 *
 * O histórico de entregas nem sempre traz `status`: em registros antigos ele
 * vem ausente, e a tela precisa dizer o que aconteceu assim mesmo. Dá para
 * reconstruir com o que sempre existe — a hora da entrega, a hora da falha, a
 * tentativa atual contra o teto e o código HTTP da resposta.
 *
 * A ordem das perguntas é a ordem da certeza: entregue é fato; falhou com
 * tentativa esgotada é fato; falhou com tentativa sobrando ainda vai
 * acontecer de novo; o resto está na fila.
 */
export type Outcome = 'DELIVERED' | 'FAILED_RETRYABLE' | 'FAILED_FINAL' | 'PENDING';

export interface DeliveryShape {
  readonly status?: string;
  readonly responseStatus?: number;
  readonly deliveredAt?: string;
  readonly failedAt?: string;
  readonly attempt?: number;
  readonly maxAttempts?: number;
  readonly nextRetryAt?: string;
}

export function deliveryOutcome(log: DeliveryShape): Outcome {
  const declared = log.status?.toUpperCase();
  if (
    declared === 'DELIVERED' ||
    declared === 'FAILED_RETRYABLE' ||
    declared === 'FAILED_FINAL' ||
    declared === 'PENDING'
  ) {
    return declared;
  }

  // A partir daqui é reconstrução.
  if (log.deliveredAt) return 'DELIVERED';

  const ok = typeof log.responseStatus === 'number' && log.responseStatus < 400;
  if (ok && !log.failedAt) return 'DELIVERED';

  const failed = log.failedAt || (typeof log.responseStatus === 'number' && !ok);
  if (!failed) return 'PENDING';

  const attempt = log.attempt ?? 0;
  const max = log.maxAttempts ?? 0;

  /* Só é "de vez" quando não sobrou tentativa. Com retentativa marcada, a
     entrega ainda vai acontecer — chamar isso de falha final assusta o lojista
     por algo que o worker resolve sozinho em dois minutos. */
  if (log.nextRetryAt) return 'FAILED_RETRYABLE';
  return max > 0 && attempt < max ? 'FAILED_RETRYABLE' : 'FAILED_FINAL';
}

const LABELS: Record<Outcome, string> = {
  DELIVERED: 'Entregue',
  FAILED_RETRYABLE: 'Vai tentar de novo',
  FAILED_FINAL: 'Falhou de vez',
  PENDING: 'Na fila',
};

const TONES: Record<Outcome, Tone> = {
  DELIVERED: 'ok',
  FAILED_RETRYABLE: 'warn',
  FAILED_FINAL: 'bad',
  PENDING: 'neutral',
};

export function outcomeLabel(outcome: Outcome): string {
  return LABELS[outcome];
}

export function outcomeTone(outcome: Outcome): Tone {
  return TONES[outcome];
}

/** Só vale reenviar o que não chegou — reenviar entrega boa duplica pedido. */
export function canRetry(outcome: Outcome): boolean {
  return outcome === 'FAILED_FINAL' || outcome === 'FAILED_RETRYABLE';
}

/**
 * O circuito aberto, explicado.
 *
 * Quando um destino falha muitas vezes seguidas, a API para de tentar por um
 * tempo. Sem essa frase, o lojista vê "nenhuma entrega" e conclui que o
 * HockPay parou de emitir eventos — quando na verdade foi o endpoint dele que
 * derrubou a linha.
 */
export function circuitExplanation(circuit?: {
  state: string;
  consecutiveFailures: number;
  openUntil?: string;
}): string | null {
  if (!circuit || circuit.state !== 'open') return null;

  const until = circuit.openUntil ? new Date(circuit.openUntil) : null;
  const when =
    until && !Number.isNaN(until.getTime())
      ? ` Novas entregas voltam a ser tentadas às ${until.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}.`
      : '';

  return (
    `Pausamos as entregas depois de ${circuit.consecutiveFailures} falhas seguidas ` +
    `neste destino.${when} Nenhum evento é perdido: eles ficam na fila.`
  );
}
