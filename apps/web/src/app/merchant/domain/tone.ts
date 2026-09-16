/**
 * O vocabulário de estado do console.
 *
 * Há irmãos deste arquivo em `shared/ui/status-chip/status.ts` (o dashboard
 * antigo) e em `admin/ui/tone.ts` (a mesa). A duplicação é escolhida, e o
 * critério é o mesmo que o admin registrou: cada superfície carrega o seu, e
 * nenhuma importa da outra — é o que faz a pasta viajar inteira no dia em que
 * virar app próprio.
 *
 * O que muda aqui em relação à mesa: **não existe `info`**. A mesa tem estado
 * que é só informação técnica (o tipo de um lançamento, o ambiente lido). O
 * lojista, não: tudo que ele lê sobre uma cobrança responde a uma pergunta
 * de dinheiro — entrou, está a caminho, ou morreu.
 *
 * O dia em que essa tradução ficar cara em três lugares, o lugar certo para
 * ela é `packages/core`, junto do enum que o backend publica — não um frontend
 * importando do outro.
 */
export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';

/** Entrou: o dinheiro chegou, o documento existe, o destino está de pé. */
const OK = [
  'CONFIRMED',
  'RELEASED',
  'PAID',
  'COMPLETED',
  'ISSUED',
  'ACTIVE',
  'APPROVED',
  'DELIVERED',
  'VERIFIED',
];

/** A caminho: alguém ainda pode agir, ou o sistema ainda está trabalhando. */
const WARN = ['PENDING', 'PROCESSING', 'OPENED', 'RETRYING'];

/** Morreu: não vira dinheiro sem uma nova tentativa. */
const BAD = [
  'FAILED',
  'FAILED_FINAL',
  'EXPIRED',
  'CANCELLED',
  'CANCELED',
  'REFUNDED',
  'REJECTED',
  'SUSPENDED',
  'INACTIVE',
  'REVOKED',
];

const LABELS: Readonly<Record<string, string>> = {
  ACTIVE: 'Ativo',
  APPROVED: 'Aprovada',
  CANCELED: 'Cancelado',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Concluído',
  CONFIRMED: 'Confirmado',
  DELIVERED: 'Entregue',
  EXPIRED: 'Expirado',
  FAILED: 'Falhou',
  FAILED_FINAL: 'Falhou de vez',
  INACTIVE: 'Inativo',
  ISSUED: 'Emitido',
  NOT_REQUESTED: 'Não solicitada',
  OPENED: 'Aberto',
  PAID: 'Pago',
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  REFUNDED: 'Estornado',
  REJECTED: 'Recusada',
  RELEASED: 'Liquidado',
  RETRYING: 'Tentando de novo',
  REVOKED: 'Revogada',
  SUSPENDED: 'Suspensa',
  VERIFIED: 'Verificada',
};

/**
 * O tom de um status. Desconhecido cai em `neutral` — uma cor errada mente
 * mais do que a ausência dela.
 */
export function statusTone(status: string): Tone {
  const normalized = status?.toUpperCase() ?? '';
  if (OK.includes(normalized)) return 'ok';
  if (WARN.includes(normalized)) return 'warn';
  if (BAD.includes(normalized)) return 'bad';
  return 'neutral';
}

/** O rótulo em português. Sem tradução conhecida, devolve o próprio status. */
export function statusLabel(status: string): string {
  return LABELS[status?.toUpperCase() ?? ''] ?? status;
}
