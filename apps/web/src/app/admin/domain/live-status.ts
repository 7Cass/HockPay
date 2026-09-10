import type { StoreLiveStatus } from './store';
import type { Tone } from '../ui/tone';

/**
 * O vocabulário de habilitação LIVE, como a mesa lê.
 *
 * Não reusa `statusLabel`/`statusTone` do dashboard de propósito: lá o
 * vocabulário é o do dinheiro (pagamento, saque, comprovante), e `SUSPENDED`
 * cairia em "neutro" — uma habilitação revogada não é informação neutra.
 */
export const LIVE_STATUS_LABEL: Readonly<Record<StoreLiveStatus, string>> = {
  NOT_REQUESTED: 'Não pedida',
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  SUSPENDED: 'Suspensa',
};

export const LIVE_STATUS_TONE: Readonly<Record<StoreLiveStatus, Tone>> = {
  NOT_REQUESTED: 'neutral',
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'bad',
  SUSPENDED: 'bad',
};

export type LiveEnablementDecision = 'approve' | 'reject' | 'suspend';

interface DecisionSpec {
  readonly decision: LiveEnablementDecision;
  readonly label: string;
  /** Estados a partir dos quais o domínio aceita esta decisão. */
  readonly from: readonly StoreLiveStatus[];
  /** Onde a loja vai parar. É o "depois" que o painel mostra antes de perguntar. */
  readonly to: StoreLiveStatus;
  /** O que muda para o lojista. A tela diz antes de perguntar o motivo. */
  readonly consequence: string;
}

/**
 * As três decisões, com os estados de origem que o domínio aceita.
 *
 * A lista espelha `Store.approveLive`, `rejectLive` e `suspendLive`. Ela não
 * substitui a regra — o domínio recusa de qualquer jeito — mas evita oferecer
 * um botão cuja única resposta possível é um erro.
 */
export const LIVE_DECISIONS: readonly DecisionSpec[] = [
  {
    decision: 'approve',
    label: 'Aprovar',
    from: ['PENDING', 'SUSPENDED'],
    to: 'APPROVED',
    consequence: 'A loja passa a poder cobrar em LIVE, e o ledger LIVE dela começa a receber.',
  },
  {
    decision: 'reject',
    label: 'Rejeitar',
    from: ['PENDING'],
    to: 'REJECTED',
    consequence: 'A loja continua só em TEST. Ela pode pedir de novo depois.',
  },
  {
    decision: 'suspend',
    label: 'Suspender',
    from: ['APPROVED'],
    to: 'SUSPENDED',
    consequence: 'A loja para de cobrar em LIVE agora. O saldo LIVE que ela já tem não some.',
  },
];

export function decisionsFor(status: StoreLiveStatus): readonly DecisionSpec[] {
  return LIVE_DECISIONS.filter((spec) => spec.from.includes(status));
}
