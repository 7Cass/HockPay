/**
 * O vocabulário de estado do produto.
 *
 * Pagamento, comprovante, saque, link e produto têm status próprios, mas a
 * leitura é a mesma em todo lugar: deu certo, está em voo, morreu, ou é só
 * informação. Cor no HockPay só entra por aqui.
 */
export type Tone = 'ok' | 'bad' | 'warn' | 'neutral';

/** Deu certo — o dinheiro chegou, o documento existe, o recurso está de pé. */
const OK = ['CONFIRMED', 'RELEASED', 'PAID', 'APPROVED', 'COMPLETED', 'ISSUED', 'ACTIVE'];

/** Em voo — alguém ainda pode agir, ou o sistema ainda está trabalhando. */
const WARN = ['PENDING', 'PROCESSING', 'OPENED'];

/** Morreu — não vira dinheiro sem uma nova tentativa. */
const BAD = ['FAILED', 'EXPIRED', 'CANCELLED', 'CANCELED', 'INACTIVE'];

const LABELS: Readonly<Record<string, string>> = {
  ACTIVE: 'Ativo',
  APPROVED: 'Aprovado',
  CANCELED: 'Cancelado',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Concluído',
  CONFIRMED: 'Confirmado',
  EXPIRED: 'Expirado',
  FAILED: 'Falhou',
  INACTIVE: 'Inativo',
  ISSUED: 'Emitido',
  OPENED: 'Aberto',
  PAID: 'Pago',
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  REFUNDED: 'Estornado',
  RELEASED: 'Liquidado',
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
