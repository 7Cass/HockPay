import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { listQuery } from '../../data/list-query';
import { OVERVIEW_QUERY, overviewResource } from '../../data/overview';
import { MerchantSession } from '../../data/session';
import { toApiFailure } from '../../domain/api-error';
import { conversionPercent } from '../../domain/conversion';
import { deltaLabel, deltaTone, ratePercent } from '../../domain/deltas';
import { attentionItems, originLabel, paymentSegments } from '../../domain/overview';
import {
  type PeriodPreset,
  periodCaption,
  rangeBlocker,
  rangeFor,
  shortDate,
} from '../../domain/period';
import {
  MerAreaChart,
  MerButton,
  MerChip,
  MerField,
  MerNotice,
  MerPageHeader,
  MerPageState,
  MerPanel,
  MerStat,
  MerTable,
} from '../../ui';

const PRESETS: readonly { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'custom', label: 'Período' },
];

/**
 * Visão geral: a primeira tela, e a única que responde "como vai a loja".
 *
 * É a que fecha a conta do redesign. A versão antiga custava **900 kB de
 * `apexcharts`** para desenhar uma área de uma série só — mais do que todo o
 * resto do bundle inicial. Aqui a mesma série sai de `mer-area-chart`, que é
 * SVG escrito à mão, e a dependência deixa o produto.
 *
 * O período mora na URL, como em toda lista do console: um recorte interessante
 * — "o que aconteceu em março" — se manda por mensagem e sobrevive ao F5, em
 * vez de morrer no estado do componente.
 *
 * O que não mudou de lugar: a conta de dinheiro. Delta e taxa chegam da API
 * como **fração**, e a tradução vive em `domain/deltas`, com teste. Foi
 * exatamente esse descuido que pôs "1%" onde eram 76% na fatia 4.
 */
@Component({
  selector: 'app-console-overview',
  standalone: true,
  imports: [
    RouterLink,
    MerAreaChart,
    MerButton,
    MerChip,
    MerField,
    MerNotice,
    MerPageHeader,
    MerPageState,
    MerPanel,
    MerStat,
    MerTable,
  ],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class ConsoleOverview {
  private readonly router = inject(Router);

  protected readonly session = inject(MerchantSession);
  protected readonly query = listQuery(OVERVIEW_QUERY);
  protected readonly params = this.query.params;
  protected readonly presets = PRESETS;

  protected readonly overview = overviewResource(this.params);
  protected readonly data = computed(() => this.overview.value());

  protected readonly preset = computed(() => this.params().preset as PeriodPreset);

  protected readonly range = computed(() =>
    rangeFor(this.preset(), {
      startDate: this.params().startDate,
      endDate: this.params().endDate,
    }),
  );

  protected readonly caption = computed(() => periodCaption(this.preset(), this.range()));

  protected readonly blocker = computed(() =>
    this.preset() === 'custom' ? rangeBlocker(this.range()) : null,
  );

  protected readonly failure = computed(() => {
    const error = this.overview.error();
    return error ? toApiFailure(error) : null;
  });

  /* ── Os cinco números ───────────────────────────────────────────────── */
  protected readonly cards = computed(() => {
    const { balance, performance } = this.data();

    return [
      {
        label: 'Disponível',
        value: this.money(balance.available),
        note: 'Pronto para sacar',
        delta: balance.availableDelta,
      },
      {
        label: 'A receber',
        value: this.money(balance.pending),
        note: 'Ainda a liberar',
        delta: balance.pendingDelta,
      },
      {
        label: 'Volume líquido',
        value: this.money(performance.netVolume),
        note: 'Depois das taxas',
        delta: performance.netVolumeDelta,
      },
      {
        label: 'Vendas',
        value: performance.salesCount.toLocaleString('pt-BR'),
        note: 'Pagamentos aprovados',
        delta: performance.salesCountDelta,
      },
      {
        label: 'Ticket médio',
        value: this.money(performance.averageTicket),
        note: 'Receita por venda',
        delta: performance.averageTicketDelta,
      },
    ];
  });

  /* ── O gráfico ──────────────────────────────────────────────────────── */
  protected readonly series = computed(() =>
    this.data().chart.map((point) => ({
      label: point.date,
      value: point.netVolume,
      extra: point.salesCount,
    })),
  );

  /**
   * Um período sem movimento não é o mesmo que um período sem dados.
   *
   * A API devolve a série completa com zeros, então o gráfico desenharia uma
   * linha reta no chão — que parece defeito. Aqui isso vira uma frase.
   */
  protected readonly isEmptyPeriod = computed(() => {
    const { performance, chart } = this.data();
    return (
      performance.salesCount === 0 &&
      performance.netVolume === 0 &&
      chart.every((point) => point.netVolume === 0 && point.salesCount === 0)
    );
  });

  /* ── Conversão e atenção ────────────────────────────────────────────── */
  protected readonly segments = computed(() =>
    paymentSegments({
      attempts: this.data().conversion.paymentAttempts,
      approved: this.data().conversion.approvedPayments,
      breakdown: this.data().paymentStatusBreakdown,
    }),
  );

  protected readonly attention = computed(() => attentionItems(this.data().attention));

  protected readonly links = computed(() => this.data().conversion);

  /* ── Ações ──────────────────────────────────────────────────────────── */
  protected setPreset(preset: PeriodPreset): void {
    if (preset === 'custom') {
      // Entrar no modo intervalo sem datas deixaria a tela sem período: começa
      // no que já estava sendo olhado.
      const range = this.range();
      this.query.set({ preset, startDate: range.startDate, endDate: range.endDate });
      return;
    }

    this.query.set({ preset, startDate: '', endDate: '' });
  }

  protected setStart(value: string): void {
    this.query.set({ preset: 'custom', startDate: value });
  }

  protected setEnd(value: string): void {
    this.query.set({ preset: 'custom', endDate: value });
  }

  protected reload(): void {
    this.overview.reload();
  }

  protected openPayment(id: string): void {
    void this.router.navigate(['/dashboard/payments', id]);
  }

  /* ── Tradução ───────────────────────────────────────────────────────── */
  protected readonly label = deltaLabel;
  protected readonly tone = deltaTone;
  protected readonly percent = ratePercent;
  protected readonly rate = conversionPercent;
  protected readonly origin = originLabel;

  /* Campos de função, e não métodos: eles são passados como entrada para o
     gráfico, e um método perde o `this` no caminho. */
  protected readonly money = (cents: number): string =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  protected readonly day = (value: string): string => shortDate(value);

  protected when(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected payerOf(payment: {
    payerName?: string;
    description?: string;
    payerEmail?: string;
    id: string;
  }): string {
    return payment.payerName || payment.description || payment.payerEmail || payment.id;
  }
}
