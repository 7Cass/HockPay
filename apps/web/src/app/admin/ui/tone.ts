/**
 * O vocabulário de estado do admin.
 *
 * Há um irmão deste arquivo em `shared/ui/status-chip/status.ts`, e a
 * duplicação é escolhida, não esquecida. Dois motivos:
 *
 * 1. O admin tem um tom que o lojista não tem — `info` —, porque numa mesa de
 *    operação existe estado que não é bom nem ruim nem em voo, é só informação
 *    técnica (o `type` de uma transação, o ambiente lido).
 * 2. `admin/` não importa nada de `shared/` de propósito: é o que faz a pasta
 *    viajar inteira quando ela virar `apps/admin`.
 *
 * O que se paga por isso é ter que traduzir um status novo em dois lugares. O
 * dia em que essa conta ficar caras, o lugar certo para o vocabulário é
 * `packages/core`, junto do enum que o backend publica — não um dos dois
 * frontends importando do outro.
 */
export type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'neutral';

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
