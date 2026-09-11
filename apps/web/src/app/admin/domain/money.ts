/**
 * Dinheiro na mesa: reais digitados por gente, centavos na API.
 *
 * O parser do painel do lojista trata `.` como separador de milhar e converte
 * multiplicando ponto flutuante, então `10.50` vira R$ 1.050,00. No painel do
 * lojista o erro custa um formulário refeito; aqui ele custa um saque de outra
 * pessoa. Por isso este é estrito: aceita o formato brasileiro e recusa o que
 * for ambíguo, em vez de adivinhar.
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

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Centavos em reais, para frase montada em código — uma mensagem de erro, por
 * exemplo. No template, o `currency` pipe continua sendo o caminho.
 */
export function formatCents(cents: number): string {
  return BRL.format(cents / 100);
}

/**
 * A política de saque do core (`WithdrawalPolicyService`), como a tela a
 * conhece: a mesma que o painel do lojista mostra.
 *
 * É cópia, e cópia diverge. A tela usa estes números para avisar antes e para
 * mostrar taxa e líquido na confirmação; quem decide é a API. Se um dia os dois
 * se separarem, o pior caso é a API recusar com a própria mensagem, e a tela a
 * mostra.
 */
export const WITHDRAWAL_POLICY = {
  feeInCents: 199,
  minAmountInCents: 1000,
  maxAmountInCents: 500000,
} as const;
