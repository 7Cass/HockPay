import { Component, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowUpRight,
  lucideChartLine,
  lucideCircleCheck,
  lucideClock3,
  lucideExternalLink,
  lucideLink,
  lucidePlus,
  lucideQrCode,
  lucideRefreshCcw,
  lucideTrendingDown,
  lucideTrendingUp,
  lucideTriangleAlert,
  lucideWallet,
} from '@ng-icons/lucide';
import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';

import {
  DashboardOverviewResponse,
  DashboardService,
} from '../../../../core/services/dashboard.service';
import { StoreService } from '../../../../core/services/store.service';
import { PageHeader, PageState, StatusChip, type Tone } from '../../../../shared/ui';

type PeriodFilter = 'today' | '7days' | '30days' | 'custom';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  yaxis: ApexYAxis | ApexYAxis[];
  tooltip: ApexTooltip;
  fill: ApexFill;
  grid: ApexGrid;
  colors: string[];
  markers: ApexMarkers;
  legend: ApexLegend;
};

/** Tokens do sistema paper/ink que o Apex precisa receber como valor literal. */
const INK = '#14140f';
const INK_FAINT = '#8d8b81';
const HAIRLINE = '#e2dfd6';
const PAPER = '#faf9f6';
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    RouterLink,
    NgApexchartsModule,
    CurrencyPipe,
    DecimalPipe,
    NgIcon,
    PageHeader,
    PageState,
    StatusChip,
  ],
  viewProviders: [
    provideIcons({
      lucideArrowUpRight,
      lucideChartLine,
      lucideCircleCheck,
      lucideClock3,
      lucideExternalLink,
      lucideLink,
      lucidePlus,
      lucideQrCode,
      lucideRefreshCcw,
      lucideTrendingDown,
      lucideTrendingUp,
      lucideTriangleAlert,
      lucideWallet,
    }),
  ],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview {
  private readonly dashboardService = inject(DashboardService);
  private readonly storeService = inject(StoreService);

  readonly overview = signal<DashboardOverviewResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly activeFilter = signal<PeriodFilter>('30days');

  /** Período customizado em `yyyy-MM-dd`, o formato que o input date fala. */
  readonly customStart = signal(this.toInputDate(this.addDays(new Date(), -29)));
  readonly customEnd = signal(this.toInputDate(new Date()));

  readonly periodFilters: Array<{ label: string; value: PeriodFilter }> = [
    { label: 'Hoje', value: 'today' },
    { label: '7D', value: '7days' },
    { label: '30D', value: '30days' },
    { label: 'Período', value: 'custom' },
  ];

  readonly selectedRange = computed(() => {
    const today = new Date();

    switch (this.activeFilter()) {
      case 'today':
        return { startDate: this.toInputDate(today), endDate: this.toInputDate(today) };
      case '7days':
        return {
          startDate: this.toInputDate(this.addDays(today, -6)),
          endDate: this.toInputDate(today),
        };
      case 'custom':
        return { startDate: this.customStart(), endDate: this.customEnd() };
      case '30days':
      default:
        return {
          startDate: this.toInputDate(this.addDays(today, -29)),
          endDate: this.toInputDate(today),
        };
    }
  });

  readonly periodCaption = computed(() => {
    switch (this.activeFilter()) {
      case 'today':
        return 'Hoje';
      case '7days':
        return 'Últimos 7 dias';
      case 'custom':
        return this.formattedPeriodRange();
      default:
        return 'Últimos 30 dias';
    }
  });

  readonly metricCards = computed(() => {
    const data = this.overview();
    if (!data) return [];

    return [
      {
        label: 'Disponível',
        context: 'Saldo liquidado',
        value: this.formatMoney(data.balance.available, data.balance.currency),
        delta: data.balance.availableDelta,
        icon: 'lucideWallet',
      },
      {
        label: 'A receber',
        context: 'Pendente de liquidação',
        value: this.formatMoney(data.balance.pending, data.balance.currency),
        delta: data.balance.pendingDelta,
        icon: 'lucideClock3',
      },
      {
        label: 'Volume líquido',
        context: 'Depois das taxas',
        value: this.formatMoney(data.performance.netVolume, data.balance.currency),
        delta: data.performance.netVolumeDelta,
        icon: 'lucideChartLine',
      },
      {
        label: 'Vendas',
        context: 'Pagamentos aprovados',
        value: new Intl.NumberFormat('pt-BR').format(data.performance.salesCount),
        delta: data.performance.salesCountDelta,
        icon: 'lucideQrCode',
      },
      {
        label: 'Ticket médio',
        context: 'Receita por venda',
        value: this.formatMoney(data.performance.averageTicket, data.balance.currency),
        delta: data.performance.averageTicketDelta,
        icon: 'lucideTrendingUp',
      },
    ];
  });

  readonly chartOptions = computed<Partial<ChartOptions>>(() => {
    const data = this.overview();
    if (!data || data.chart.length === 0) return {};

    return {
      series: [
        {
          name: 'Volume líquido',
          type: 'area',
          data: data.chart.map((item) => item.netVolume / 100),
        },
      ],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: MONO,
        sparkline: { enabled: false },
      },
      colors: [INK],
      dataLabels: { enabled: false },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 0, opacityFrom: 0.14, opacityTo: 0.01, stops: [0, 92, 100] },
      },
      grid: {
        borderColor: HAIRLINE,
        strokeDashArray: 3,
        padding: { top: 12, right: 12, bottom: 0, left: 8 },
      },
      legend: { show: false },
      markers: { size: 0, strokeColors: PAPER, strokeWidth: 2, hover: { size: 4 } },
      stroke: { width: 1.75, curve: 'smooth', lineCap: 'round' },
      xaxis: {
        categories: data.chart.map((item) => this.formatChartDate(item.date)),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: INK_FAINT, fontSize: '10px', fontFamily: MONO } },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: {
          formatter: (value) => this.formatCompactMoney(value * 100, data.balance.currency),
          style: { colors: INK_FAINT, fontSize: '10px', fontFamily: MONO },
        },
      },
      tooltip: {
        shared: false,
        intersect: false,
        theme: 'light',
        custom: ({ series, dataPointIndex }: { series: number[][]; dataPointIndex: number }) => {
          const point = data.chart[dataPointIndex];
          const volume = series[0]?.[dataPointIndex] ?? 0;
          const sales = new Intl.NumberFormat('pt-BR').format(point.salesCount);

          // Renderizado fora do template: estilo inline, não classe do componente.
          return `
            <div style="border:1px solid ${HAIRLINE};border-radius:11px;background:#fff;padding:0.6rem 0.75rem;box-shadow:0 18px 36px -22px rgb(20 20 15 / 0.45)">
              <div style="font-family:${MONO};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${INK_FAINT}">${this.formatChartDate(point.date)}</div>
              <div style="margin-top:0.35rem;font-size:14px;font-variant-numeric:tabular-nums;color:${INK}">${this.formatMoney(volume * 100, data.balance.currency)}</div>
              <div style="margin-top:0.15rem;font-family:${MONO};font-size:10.5px;color:${INK_FAINT}">${sales} vendas aprovadas</div>
            </div>`;
        },
      },
    };
  });

  readonly linkConversion = computed(() => {
    const conversion = this.overview()?.conversion;
    if (!conversion) {
      return { linksCreated: 0, linksPaid: 0, conversionRate: 0, conversionPercent: 0 };
    }

    return {
      linksCreated: conversion.linksCreated,
      linksPaid: conversion.linksPaid,
      conversionRate: conversion.linkConversionRate,
      conversionPercent: this.ratePercent(conversion.linkConversionRate),
    };
  });

  readonly paymentStatusSegments = computed(() => {
    const data = this.overview();
    if (!data) return [];

    const attempts = data.conversion.paymentAttempts;
    if (attempts <= 0) return [];

    const approved = data.conversion.approvedPayments;
    const failed = this.paymentStatusCount(['FAILED']);
    const expired = this.paymentStatusCount(['EXPIRED']);
    const refunded = this.paymentStatusCount(['REFUNDED']);
    const other = Math.max(0, attempts - approved - failed - expired - refunded);

    return [
      { label: 'Aprovadas', value: approved, tone: 'ok' as Tone },
      { label: 'Falhas', value: failed, tone: 'bad' as Tone },
      { label: 'Expiradas', value: expired, tone: 'warn' as Tone },
      { label: 'Estornadas', value: refunded, tone: 'neutral' as Tone },
      { label: 'Outros', value: other, tone: 'neutral' as Tone },
    ]
      .filter((item) => item.value > 0)
      .map((item) => ({ ...item, percent: (item.value / attempts) * 100 }));
  });

  readonly attentionItems = computed(() => {
    const attention = this.overview()?.attention;
    if (!attention) return [];

    return [
      {
        label: 'Webhooks falhos',
        value: attention.failedWebhookDeliveries,
        route: '/dashboard/webhooks',
      },
      {
        label: 'Webhooks pendentes',
        value: attention.pendingWebhookDeliveries,
        route: '/dashboard/webhooks',
      },
      {
        label: 'Alertas falhos',
        value: attention.failedAlertDeliveries,
        route: '/dashboard/alerts',
      },
      {
        label: 'Alertas pendentes',
        value: attention.pendingAlertDeliveries,
        route: '/dashboard/alerts',
      },
    ].filter((item) => item.value > 0);
  });

  readonly attentionTotal = computed(() =>
    this.attentionItems().reduce((total, item) => total + item.value, 0),
  );

  readonly isEmptyPeriod = computed(() => {
    const data = this.overview();
    if (!data) return false;

    return (
      data.performance.salesCount === 0 &&
      data.performance.netVolume === 0 &&
      data.chart.every((item) => item.netVolume === 0 && item.salesCount === 0)
    );
  });

  private requestId = 0;

  constructor() {
    effect(() => {
      const store = this.storeService.currentStore();
      const range = this.selectedRange();

      if (store && range.startDate && range.endDate) {
        this.loadOverview(range.startDate, range.endDate);
      }
    });
  }

  setFilter(filter: PeriodFilter) {
    this.activeFilter.set(filter);
  }

  setCustomStart(value: string) {
    this.customStart.set(value);
    this.activeFilter.set('custom');
  }

  setCustomEnd(value: string) {
    this.customEnd.set(value);
    this.activeFilter.set('custom');
  }

  reload() {
    const range = this.selectedRange();
    if (!range.startDate || !range.endDate) return;
    this.loadOverview(range.startDate, range.endDate);
  }

  formattedPeriodRange(): string {
    const period = this.overview()?.period;
    const range = period
      ? { startDate: period.startDate, endDate: period.endDate }
      : this.selectedRange();

    return `${this.formatDate(range.startDate)} – ${this.formatDate(range.endDate)}`;
  }

  defaultCurrency(): string {
    return this.overview()?.balance.currency || 'BRL';
  }

  /** Variação positiva é `ok`, negativa é `bad`, ausente não tem tom. */
  deltaTone(delta: number | null): Tone | null {
    if (delta === null || delta === 0) return null;
    return delta > 0 ? 'ok' : 'bad';
  }

  deltaIcon(delta: number | null): string {
    return delta !== null && delta < 0 ? 'lucideTrendingDown' : 'lucideTrendingUp';
  }

  formatDelta(delta: number): string {
    const prefix = delta > 0 ? '+' : '';
    const value = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(delta * 100);

    return `${prefix}${value}%`;
  }

  formatRate(value: number): string {
    const percent = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(this.ratePercent(value));

    return `${percent}%`;
  }

  ratePercent(value: number): number {
    return Math.max(0, Math.min(100, (value || 0) * 100));
  }

  private paymentStatusCount(statuses: string[]): number {
    const normalized = new Set(statuses.map((status) => status.toUpperCase()));

    return (
      this.overview()
        ?.paymentStatusBreakdown.filter((item) => normalized.has(item.status.toUpperCase()))
        .reduce((total, item) => total + item.count, 0) ?? 0
    );
  }

  originLabel(origin: DashboardOverviewResponse['recentPayments'][number]['origin']): string {
    const labels: Record<DashboardOverviewResponse['recentPayments'][number]['origin'], string> = {
      api: 'API',
      checkout: 'Checkout',
      payment_link: 'Link',
      unknown: 'Desconhecida',
    };

    return labels[origin] ?? labels.unknown;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private loadOverview(startDate: string, endDate: string) {
    const currentRequest = ++this.requestId;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.dashboardService
      .getOverview(this.startOfDayIso(startDate), this.endOfDayIso(endDate))
      .subscribe({
        next: (data) => {
          if (currentRequest !== this.requestId) return;
          this.overview.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          if (currentRequest !== this.requestId) return;
          console.error('Failed to load dashboard overview', err);
          this.errorMessage.set('Confira sua conexão e tente novamente em alguns instantes.');
          this.overview.set(null);
          this.isLoading.set(false);
        },
      });
  }

  private formatMoney(value: number, currency = 'BRL'): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  }

  private formatCompactMoney(value: number, currency = 'BRL'): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value / 100);
  }

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
      this.parseDate(value),
    );
  }

  private formatChartDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
      this.parseDate(value),
    );
  }

  private toInputDate(date?: Date): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private parseDate(value: string): Date {
    if (value.includes('T')) return new Date(value);

    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private startOfDayIso(value: string): string {
    const date = this.parseDate(value);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }

  private endOfDayIso(value: string): string {
    const date = this.parseDate(value);
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
  }
}
