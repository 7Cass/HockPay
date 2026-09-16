/**
 * O período que a visão geral olha.
 *
 * Tudo aqui é hora **local**, e isso não é detalhe de estilo: o dia do lojista
 * é o dia do fuso dele. `new Date('2026-09-16')` é meia-noite em UTC, que no
 * Brasil cai às 21h do dia 15 — somar hora a partir daí escolhe o dia errado, e
 * o faturamento de segunda aparece no domingo. Por isso a data da URL é
 * desmontada em número e remontada no fuso de quem olha.
 */
export type PeriodPreset = 'today' | '7d' | '30d' | 'custom';

export interface PeriodRange {
  /** `yyyy-mm-dd`, o formato que o `<input type="date">` fala. */
  readonly startDate: string;
  readonly endDate: string;
}

/** Desmonta `yyyy-mm-dd` e remonta no fuso local. */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? '');
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  // `new Date(2026, 1, 31)` vira 3 de março sem reclamar. Se o dia mudou, a
  // data não existia.
  return date.getDate() === Number(day) ? date : null;
}

export function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * O intervalo de um atalho.
 *
 * `today` recebe o dia de fora para o teste não depender de quando roda — e
 * para a tela poder congelar a data numa captura.
 */
export function rangeFor(
  preset: PeriodPreset,
  custom: PeriodRange,
  today: Date = new Date(),
): PeriodRange {
  switch (preset) {
    case 'today':
      return { startDate: toInputDate(today), endDate: toInputDate(today) };

    case '7d':
      // Sete dias contando hoje, e não hoje mais sete.
      return { startDate: toInputDate(addDays(today, -6)), endDate: toInputDate(today) };

    case 'custom':
      return custom.startDate && custom.endDate
        ? custom
        : { startDate: toInputDate(addDays(today, -29)), endDate: toInputDate(today) };

    case '30d':
    default:
      return { startDate: toInputDate(addDays(today, -29)), endDate: toInputDate(today) };
  }
}

/** O instante em que o dia do lojista começa. */
export function startOfDayIso(value: string): string {
  const date = parseLocalDate(value) ?? new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/** E o instante em que ele acaba — inclusive o último milissegundo. */
export function endOfDayIso(value: string): string {
  const date = parseLocalDate(value) ?? new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

/** `2026-09-16` → `16/09`. O eixo do gráfico e o balão. */
export function shortDate(value: string): string {
  const date = parseLocalDate(value);
  return date ? DAY_MONTH.format(date) : value;
}

/** O que escrever em cima da tela para dizer o que se está olhando. */
export function periodCaption(preset: PeriodPreset, range: PeriodRange): string {
  switch (preset) {
    case 'today':
      return 'Hoje';
    case '7d':
      return 'Últimos 7 dias';
    case '30d':
      return 'Últimos 30 dias';
    default:
      return `${shortDate(range.startDate)} a ${shortDate(range.endDate)}`;
  }
}

/**
 * O que impede de pedir este intervalo — ou `null` quando está tudo certo.
 *
 * Um intervalo invertido não dá erro na API: dá um período vazio, que a tela
 * mostraria como "sem atividade". Dizer "a data final é antes da inicial" custa
 * uma linha e evita a conclusão errada de que a loja não vendeu nada.
 */
export function rangeBlocker(range: PeriodRange): string | null {
  const start = parseLocalDate(range.startDate);
  const end = parseLocalDate(range.endDate);

  if (!start || !end) return 'Escolha uma data inicial e uma final.';
  if (start > end) return 'A data final é anterior à inicial.';

  return null;
}
