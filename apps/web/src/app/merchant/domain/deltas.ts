import type { Tone } from './tone';

/**
 * A variação contra o período anterior.
 *
 * A API manda **fração**, e não percentual: `netVolumeDelta: 0.12` é doze por
 * cento a mais. É a mesma armadilha de [[conversion]] — lá, arredondar a
 * fração direto pôs "1%" na tela onde eram 76%. Por isso a conta mora aqui,
 * com teste, e não num `Math.round` perdido no componente.
 *
 * `null` é um caso de verdade e não um zero: significa que **não há período
 * anterior comparável** (loja nova, ou o primeiro intervalo com movimento).
 * "0%" mentiria dizendo que ficou igual.
 */
export function deltaLabel(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return null;

  const percent = delta * 100;

  /* Uma casa decimal só abaixo de dez por cento. Acima disso a casa não muda
     decisão nenhuma e só alarga o cartão. */
  const rounded = Math.abs(percent) >= 10 ? Math.round(percent) : Math.round(percent * 10) / 10;

  if (rounded === 0) {
    // Arredondou para zero mas mexeu: dizer "0%" esconde que houve variação.
    return delta === 0 ? '0%' : '≈0%';
  }

  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${Math.abs(rounded).toLocaleString('pt-BR')}%`;
}

/**
 * O tom da variação. Sem comparativo, sem cor.
 *
 * Subir é bom e descer é ruim **para volume e venda**, que é tudo que a visão
 * geral compara hoje. No dia em que entrar uma métrica onde subir é ruim — taxa
 * de falha, tempo de liquidação —, ela passa `invert` em vez de nascer uma
 * segunda função que faz quase o mesmo.
 */
export function deltaTone(delta: number | null | undefined, invert = false): Tone | null {
  if (delta === null || delta === undefined || !Number.isFinite(delta) || delta === 0) {
    return null;
  }

  const good = invert ? delta < 0 : delta > 0;
  return good ? 'ok' : 'bad';
}

/**
 * A taxa que a API manda como fração, presa entre 0 e 100.
 *
 * O grampo existe porque a largura de uma barra sai daqui: uma taxa de 1,2
 * (que o backend pode devolver num período com mais pagos do que criados, por
 * causa de link pago fora da janela) viraria uma barra de 120% da caixa.
 */
export function ratePercent(rate: number | null | undefined): number {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(100, rate * 100));
}
