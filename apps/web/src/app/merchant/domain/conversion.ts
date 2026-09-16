/**
 * A taxa de conversão dos links, como a API a manda e como a tela a lê.
 *
 * O repositório devolve **fração** (`paid / total`), e não percentual:
 * `packages/infrastructure/src/repositories/payment-link.repository.ts` faz
 * `conversionRate: total > 0 ? paid / total : 0`.
 *
 * Isso já me custou uma tela errada: com 144 links pagos de 189, a lista
 * mostrou **1%**, porque eu arredondei `0,76` direto. Número de dinheiro
 * errado na tela é o defeito mais caro que este console pode ter — então a
 * conversão virou função pura, com teste, em vez de um `Math.round` perdido
 * num componente.
 */
export function conversionPercent(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return '0%';

  // A fração vira percentual; uma casa só, porque a segunda não muda decisão
  // nenhuma e enche a coluna.
  const percent = rate * 100;
  const rounded = percent >= 10 ? Math.round(percent) : Math.round(percent * 10) / 10;

  return `${rounded.toLocaleString('pt-BR')}%`;
}
