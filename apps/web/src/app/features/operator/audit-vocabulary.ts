import type { StoreLiveStatus } from '../../core/services/store.service';
import type { Tone } from '../../shared/ui';
import { LIVE_STATUS_LABEL } from './live-status';

/**
 * O vocabulário da trilha.
 *
 * Uma trilha que só existe no banco é um log; uma que aparece na tela como JSON
 * cru é o mesmo log com mais passos. Este arquivo é o que traduz uma linha
 * gravada pelo backend para uma frase — e ele degrada em vez de mentir: ação
 * desconhecida vira o próprio código, campo desconhecido vira `chave: valor`.
 */
interface ActionSpec {
  readonly label: string;
  readonly tone: Tone;
}

const ACTIONS: Readonly<Record<string, ActionSpec>> = {
  'operator.login': { label: 'Entrou na mesa', tone: 'neutral' },
  'operator.logout': { label: 'Saiu da mesa', tone: 'neutral' },
  'store.live_approved': { label: 'Aprovou LIVE', tone: 'ok' },
  'store.live_rejected': { label: 'Rejeitou LIVE', tone: 'bad' },
  'store.live_suspended': { label: 'Suspendeu LIVE', tone: 'bad' },
  'store.commercial_terms_changed': { label: 'Mudou condição comercial', tone: 'warn' },
  'store.investigated': { label: 'Abriu para investigar', tone: 'neutral' },
};

export function actionLabel(action: string): string {
  return ACTIONS[action]?.label ?? action;
}

export function actionTone(action: string): Tone {
  return ACTIONS[action]?.tone ?? 'neutral';
}

/** Uma diferença entre o antes e o depois, já em português e já formatada. */
export interface ReadableChange {
  field: string;
  before: string;
  after: string;
}

const FIELD_LABEL: Readonly<Record<string, string>> = {
  liveStatus: 'Habilitação LIVE',
  feePercent: 'Taxa variável',
  feeFixed: 'Taxa fixa',
  settlementDays: 'Prazo de liquidação',
};

/**
 * Traduz um par before/after para linhas legíveis.
 *
 * Percorre a união das chaves dos dois lados: um campo que só existe depois
 * (ou só antes) é uma mudança, e sumir dela seria esconder exatamente o que a
 * trilha existe para mostrar. Campos iguais dos dois lados não entram —
 * `store.commercial_terms_changed` grava os três sempre, e listar os que não
 * mudaram afogaria o que mudou.
 */
export function readableChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): ReadableChange[] {
  if (!before && !after) return [];

  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];

  return keys
    .filter((key) => !isSame(before?.[key], after?.[key]))
    .map((key) => ({
      field: FIELD_LABEL[key] ?? key,
      before: formatValue(key, before?.[key]),
      after: formatValue(key, after?.[key]),
    }));
}

function isSame(a: unknown, b: unknown): boolean {
  return a === b || (a === undefined && b === undefined);
}

function formatValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return '—';

  switch (key) {
    case 'liveStatus':
      return LIVE_STATUS_LABEL[value as StoreLiveStatus] ?? String(value);
    case 'feePercent':
      return `${value}%`;
    case 'feeFixed':
      return formatCents(value);
    case 'settlementDays':
      return `${value} ${value === 1 ? 'dia' : 'dias'}`;
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

function formatCents(value: unknown): string {
  const cents = Number(value);
  if (!Number.isFinite(cents)) return String(value);

  // `toLocaleString` separa o símbolo com espaço inquebrável; para o leitor é
  // o mesmo espaço, e um espaço comum é o que dá para comparar em um teste.
  return (cents / 100)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(/\u00a0/g, ' ');
}
