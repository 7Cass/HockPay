import type { Tone } from './tone';

export interface StatusBreakdownItem {
  readonly status: string;
  readonly count: number;
  /** Quanto, em centavos. A API manda; a tela antiga ignorava. */
  readonly amount?: number;
}

export interface StatusSegment {
  readonly label: string;
  readonly value: number;
  readonly amount: number;
  readonly percent: number;
  readonly tone: Tone;
}

/**
 * O que aconteceu com as tentativas de pagamento do período.
 *
 * Isto era um `computed` dentro do componente antigo, junto de mais quatrocentas
 * linhas de tela. Aqui é função pura: a conta que decide a largura de uma barra
 * é regra, e regra se testa sem subir Angular.
 *
 * **"Outros" existe porque a soma tem de fechar.** A API manda o total de
 * tentativas e uma quebra por status; os status que a tela nomeia (aprovado,
 * falho, expirado, estornado) quase nunca somam o total, porque sempre há
 * cobrança ainda pendente no meio. Sem o resto explícito, a barra ficaria mais
 * curta que a caixa e ninguém saberia por quê.
 *
 * **Cada faixa carrega o valor, e não só a contagem.** "25 expiradas" não diz
 * nada; "25 expiradas, R$ 4.521,90" diz quanto dinheiro deixou de entrar — que
 * é a pergunta que faz alguém mudar o prazo da cobrança.
 */
export function paymentSegments(input: {
  attempts: number;
  approved: number;
  approvedAmount?: number;
  breakdown: readonly StatusBreakdownItem[];
}): readonly StatusSegment[] {
  const { attempts, approved } = input;
  if (!Number.isFinite(attempts) || attempts <= 0) return [];

  const pick = (status: string) =>
    input.breakdown
      .filter((item) => item.status?.toUpperCase() === status)
      .reduce(
        (total, item) => ({
          count: total.count + item.count,
          amount: total.amount + (item.amount ?? 0),
        }),
        { count: 0, amount: 0 },
      );

  const confirmed = pick('CONFIRMED');
  const released = pick('RELEASED');
  const failed = pick('FAILED');
  const expired = pick('EXPIRED');
  const refunded = pick('REFUNDED');

  const other = Math.max(0, attempts - approved - failed.count - expired.count - refunded.count);

  return (
    [
      {
        label: 'Aprovadas',
        value: approved,
        // O aprovado pode vir de dois status; quando a quebra não os traz, o
        // valor informado de fora é o que vale.
        amount: input.approvedAmount ?? confirmed.amount + released.amount,
        tone: 'ok' as Tone,
      },
      { label: 'Falhas', value: failed.count, amount: failed.amount, tone: 'bad' as Tone },
      { label: 'Expiradas', value: expired.count, amount: expired.amount, tone: 'warn' as Tone },
      {
        label: 'Estornadas',
        value: refunded.count,
        amount: refunded.amount,
        tone: 'neutral' as Tone,
      },
      { label: 'Outros', value: other, amount: 0, tone: 'neutral' as Tone },
    ]
      // Faixa de largura zero não aparece, mas ocupa lugar na legenda.
      .filter((segment) => segment.value > 0)
      .map((segment) => ({ ...segment, percent: (segment.value / attempts) * 100 }))
  );
}

export interface FunnelStep {
  readonly label: string;
  readonly value: number;
  /** Largura da barra: sempre contra o primeiro passo. */
  readonly percent: number;
  /** Quanto sobrou do passo anterior — onde a perda acontece. */
  readonly fromPrevious: number | null;
}

/**
 * O caminho de um link: criado, (aberto), pago.
 *
 * Uma taxa de conversão sozinha diz que se perde, não **onde**. Trinta links
 * criados com vinte e quatro abertos e vinte e um pagos conta uma história bem
 * diferente de trinta criados, vinte e um abertos e vinte e um pagos: no
 * primeiro caso o problema é a página de pagamento, no segundo é a divulgação.
 *
 * **O passo "Abertos" só aparece quando a API o alimenta.** Medido em
 * `2026-09-16`: `linksOpened` volta `0` com 21 links pagos na mesma resposta —
 * o campo existe no contrato e ninguém o preenche. Desenhar
 * "30 criados → 0 abertos → 21 pagos" seria um funil que se desmente sozinho,
 * e o lojista acreditaria no zero. Um passo que não se sabe medir não vira
 * gráfico; vira ausência.
 *
 * Os passos também nunca crescem: a API pode devolver mais abertos do que
 * criados quando um link nascido antes da janela é aberto dentro dela, e um
 * funil que engorda é uma mentira visual. O valor exibido continua sendo o
 * real; o que se prende é a largura da barra.
 */
export function linkFunnel(conversion: {
  linksCreated: number;
  linksOpened: number;
  linksPaid: number;
}): readonly FunnelStep[] {
  const created = Math.max(0, conversion.linksCreated ?? 0);
  if (created === 0) return [];

  const opened = Math.max(0, conversion.linksOpened ?? 0);
  const paid = Math.max(0, conversion.linksPaid ?? 0);

  const share = (value: number) => Math.max(0, Math.min(100, (value / created) * 100));
  const ratio = (value: number, previous: number) => (previous > 0 ? value / previous : null);

  const steps: FunnelStep[] = [
    { label: 'Criados', value: created, percent: 100, fromPrevious: null },
  ];

  // Zero abertos com link pago é campo não alimentado, não é aviso de que
  // ninguém abriu: não dá para pagar um link sem abrir.
  const medeAbertura = opened > 0 || paid === 0;

  if (medeAbertura) {
    steps.push({
      label: 'Abertos',
      value: opened,
      percent: share(opened),
      fromPrevious: ratio(opened, created),
    });
  }

  steps.push({
    label: 'Pagos',
    value: paid,
    percent: share(paid),
    fromPrevious: ratio(paid, medeAbertura && opened > 0 ? opened : created),
  });

  return steps;
}

export interface MoneyFlow {
  readonly gross: number;
  readonly fees: number;
  readonly net: number;
  /** Quanto da receita bruta virou taxa, como fração. */
  readonly feeShare: number;
  /** A taxa veio da diferença, e não de um campo próprio. */
  readonly feesDerived: boolean;
}

/**
 * A conta do período em uma linha: bruto, taxa, líquido.
 *
 * O console mostrava o líquido e escondia o resto. "Entrou R$ 33.256" responde
 * metade da pergunta; a outra metade — quanto foi cobrado para isso acontecer —
 * é a que o lojista usa para negociar condição comercial.
 *
 * **A taxa é derivada quando o campo vem zerado.** Medido em `2026-09-16`:
 * `feeVolume` volta `0` enquanto `grossVolume - netVolume` dá R$ 531,76 na
 * mesma resposta. Escrever "Taxas R$ 0,00" ao lado de uma conta que não fecha
 * é pior do que não mostrar nada — e a diferença entre bruto e líquido **é** a
 * taxa, por definição, então o número derivado é exato, não estimado.
 */
export function moneyFlow(performance: {
  grossVolume: number;
  feeVolume: number;
  netVolume: number;
}): MoneyFlow {
  const gross = performance.grossVolume ?? 0;
  const net = performance.netVolume ?? 0;
  const informado = performance.feeVolume ?? 0;

  const diferenca = Math.max(0, gross - net);
  const fees = informado > 0 ? informado : diferenca;

  return {
    gross,
    fees,
    net,
    feeShare: gross > 0 ? fees / gross : 0,
    feesDerived: informado <= 0 && diferenca > 0,
  };
}

export interface AttentionShape {
  readonly failedWebhookDeliveries: number;
  readonly pendingWebhookDeliveries: number;
  readonly failedAlertDeliveries: number;
  readonly pendingAlertDeliveries: number;
}

export interface AttentionItem {
  readonly label: string;
  readonly value: number;
  readonly route: string;
  readonly tone: Tone;
}

/**
 * O que ainda pede ação — e só isso.
 *
 * Fila e falha de entrega entram; cobrança pendente **não**. Uma cobrança
 * esperando pagamento é o funcionamento normal de um Pix, não um problema: se
 * ela entrasse aqui, o painel viveria em alerta e ninguém mais olharia para
 * ele. O que sobra é o que tem dono e conserto — e por isso cada item leva a
 * tela onde se conserta.
 */
export function attentionItems(attention: AttentionShape | undefined): readonly AttentionItem[] {
  if (!attention) return [];

  return [
    {
      label: 'Entregas de webhook falhas',
      value: attention.failedWebhookDeliveries,
      route: '/dashboard/webhooks',
      tone: 'bad' as Tone,
    },
    {
      label: 'Entregas de webhook na fila',
      value: attention.pendingWebhookDeliveries,
      route: '/dashboard/webhooks',
      tone: 'warn' as Tone,
    },
    {
      label: 'Alertas falhos',
      value: attention.failedAlertDeliveries,
      route: '/dashboard/alerts',
      tone: 'bad' as Tone,
    },
    {
      label: 'Alertas na fila',
      value: attention.pendingAlertDeliveries,
      route: '/dashboard/alerts',
      tone: 'warn' as Tone,
    },
  ].filter((item) => item.value > 0);
}

/** A origem de um pagamento, na voz do lojista. */
export function originLabel(origin: string): string {
  const labels: Record<string, string> = {
    api: 'API',
    checkout: 'Checkout',
    payment_link: 'Link',
    unknown: 'Desconhecida',
  };

  return labels[origin] ?? labels['unknown'];
}
