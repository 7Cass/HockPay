/**
 * Dinheiro na mesa: reais digitados por gente, centavos na API.
 *
 * O parser mora em `core/money/reais.ts`, porque o painel do lojista precisa
 * do mesmo, e chega aqui pela costura. É estrito de propósito: `10.50` é
 * recusado em vez de lido como R$ 1.050,00.
 */
export { centsToReaisText, parseReaisToCents } from './api-contracts';

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
