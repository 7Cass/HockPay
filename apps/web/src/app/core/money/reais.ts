/**
 * Reais digitados por gente, centavos na API.
 *
 * Mora em `core/` porque os dois lados da aplicação precisam dele e nenhum
 * pode importar do outro: o painel do lojista usa direto, e o admin recebe pela
 * costura `admin/domain/api-contracts.ts`.
 *
 * Existe porque o parser que ele substituiu tratava `.` como separador de
 * milhar e convertia multiplicando ponto flutuante, então `10.50` virava
 * R$ 1.050,00 — num campo de saque, de estorno, de preço. Este é estrito: aceita
 * o formato brasileiro e recusa o que for ambíguo, em vez de adivinhar.
 *
 * Aceita `10`, `10,5`, `10,50`, `1.234,56` e `R$ 1.234,56`. Recusa `10.50`
 * (ponto não é decimal aqui), `1,234` (três casas), grupos de milhar tortos,
 * sinal e texto. A conversão é por texto, sem multiplicação: `0,29` é 29
 * centavos, e não 28,999….
 */
const BRL_AMOUNT = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

export function parseReaisToCents(text: string): number | null {
  const raw = text.replace(/^\s*R\$\s*/, '').trim();
  const match = BRL_AMOUNT.exec(raw);
  if (!match) return null;

  const reais = match[1].replace(/\./g, '');
  const centavos = (match[2] ?? '').padEnd(2, '0');
  const cents = Number(`${reais}${centavos}`);

  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * Centavos no formato que `parseReaisToCents` lê de volta, sem símbolo e sem
 * milhar: `123456` vira `1234,56`. É o valor que um campo começa preenchido.
 */
export function centsToReaisText(cents: number): string {
  const reais = Math.floor(cents / 100);
  const centavos = String(cents % 100).padStart(2, '0');
  return `${reais},${centavos}`;
}
