import type { Tone } from './tone';

export interface StatusBreakdownItem {
  readonly status: string;
  readonly count: number;
}

export interface StatusSegment {
  readonly label: string;
  readonly value: number;
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
 */
export function paymentSegments(input: {
  attempts: number;
  approved: number;
  breakdown: readonly StatusBreakdownItem[];
}): readonly StatusSegment[] {
  const { attempts, approved } = input;
  if (!Number.isFinite(attempts) || attempts <= 0) return [];

  const count = (status: string) =>
    input.breakdown
      .filter((item) => item.status?.toUpperCase() === status)
      .reduce((total, item) => total + item.count, 0);

  const failed = count('FAILED');
  const expired = count('EXPIRED');
  const refunded = count('REFUNDED');
  const other = Math.max(0, attempts - approved - failed - expired - refunded);

  return (
    [
      { label: 'Aprovadas', value: approved, tone: 'ok' as Tone },
      { label: 'Falhas', value: failed, tone: 'bad' as Tone },
      { label: 'Expiradas', value: expired, tone: 'warn' as Tone },
      { label: 'Estornadas', value: refunded, tone: 'neutral' as Tone },
      { label: 'Outros', value: other, tone: 'neutral' as Tone },
    ]
      // Faixa de largura zero não aparece, mas ocupa lugar na legenda.
      .filter((segment) => segment.value > 0)
      .map((segment) => ({ ...segment, percent: (segment.value / attempts) * 100 }))
  );
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
