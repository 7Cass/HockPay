import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import {
  lucideAlertTriangle,
  lucideArrowUpRight,
  lucideBadgeCheck,
  lucideCalendarDays,
  lucideCheckCircle2,
  lucideClock3,
  lucideCreditCard,
  lucideExternalLink,
  lucideLineChart,
  lucideLink,
  lucideLoader2,
  lucidePlus,
  lucideRefreshCcw,
  lucideShieldCheck,
  lucideTrendingUp,
  lucideWallet,
  lucideXCircle,
} from '@ng-icons/lucide';
import { DashboardOverviewResponse, DashboardService } from '../../../../core/services/dashboard.service';
import { StoreService } from '../../../../core/services/store.service';
import {
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

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, NgApexchartsModule, CurrencyPipe, NgIconComponent, HlmDatePickerImports, HlmIconImports],
  viewProviders: [
    provideIcons({
      lucideAlertTriangle,
      lucideArrowUpRight,
      lucideBadgeCheck,
      lucideCalendarDays,
      lucideCheckCircle2,
      lucideClock3,
      lucideCreditCard,
      lucideExternalLink,
      lucideLineChart,
      lucideLink,
      lucideLoader2,
      lucidePlus,
      lucideRefreshCcw,
      lucideShieldCheck,
      lucideTrendingUp,
      lucideWallet,
      lucideXCircle,
    }),
  ],
  templateUrl: './overview.html',
})
export class Overview {
  private readonly dashboardService = inject(DashboardService);
  private readonly storeService = inject(StoreService);

  readonly overview = signal<DashboardOverviewResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly activeFilter = signal<PeriodFilter>('30days');
  readonly customDateRange = signal<[Date, Date] | undefined>([this.addDays(new Date(), -29), new Date()]);

  readonly periodFilters: Array<{ label: string; value: PeriodFilter }> = [
    { label: 'Hoje', value: 'today' },
    { label: '7D', value: '7days' },
    { label: '30D', value: '30days' },
    { label: 'Custom', value: 'custom' },
  ];

  readonly formatDateRange = (dates: [Date | undefined, Date | undefined]): string => {
    const [start, end] = dates;
    if (start && end) return `${this.formatDisplayDate(start)} - ${this.formatDisplayDate(end)}`;
    if (start) return `A partir de ${this.formatDisplayDate(start)}`;
    if (end) return `Até ${this.formatDisplayDate(end)}`;
    return '';
  };

  readonly selectedRange = computed(() => {
    const today = new Date();

    switch (this.activeFilter()) {
      case 'today':
        return { startDate: this.toInputDate(today), endDate: this.toInputDate(today) };
      case '7days':
        return { startDate: this.toInputDate(this.addDays(today, -6)), endDate: this.toInputDate(today) };
      case 'custom': {
        const [start, end] = this.customDateRange() ?? [];
        return { startDate: this.toInputDate(start), endDate: this.toInputDate(end) };
      }
      case '30days':
      default:
        return { startDate: this.toInputDate(this.addDays(today, -29)), endDate: this.toInputDate(today) };
    }
  });

  readonly periodCaption = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'today') return 'Hoje';
    if (filter === '7days') return 'Últimos 7 dias';
    if (filter === 'custom') return 'Período customizado';
    return 'Últimos 30 dias';
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
        context: 'Após taxas',
        value: this.formatMoney(data.performance.netVolume, data.balance.currency),
        delta: data.performance.netVolumeDelta,
        icon: 'lucideLineChart',
      },
      {
        label: 'Vendas',
        context: 'Pagamentos aprovados',
        value: new Intl.NumberFormat('pt-BR').format(data.performance.salesCount),
        delta: data.performance.salesCountDelta,
        icon: 'lucideCreditCard',
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
        fontFamily: 'Inter, sans-serif',
        sparkline: { enabled: false },
      },
      colors: ['#4f46e5'],
      dataLabels: { enabled: false },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 0.45,
          opacityFrom: 0.42,
          opacityTo: 0.04,
          stops: [0, 90, 100],
        },
      },
      grid: {
        borderColor: '#eef2ff',
        strokeDashArray: 4,
        padding: { top: 12, right: 12, bottom: 0, left: 8 },
      },
      legend: {
        show: false,
      },
      markers: {
        size: 0,
        strokeColors: '#ffffff',
        strokeWidth: 2,
        hover: { size: 5 },
      },
      stroke: { width: 3, curve: 'smooth', lineCap: 'round' },
      xaxis: {
        categories: data.chart.map((item) => this.formatChartDate(item.date)),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: '#71717a', fontSize: '12px' } },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: {
          formatter: (value) => this.formatCompactMoney(value * 100, data.balance.currency),
          style: { colors: '#71717a', fontSize: '12px' },
        },
      },
      tooltip: {
        shared: false,
        intersect: false,
        theme: 'light',
        custom: ({ series, dataPointIndex, w }: { series: number[][]; dataPointIndex: number; w: { globals: { categoryLabels?: string[]; labels?: string[] } } }) => {
          const point = data.chart[dataPointIndex];
          const label = w.globals.categoryLabels?.[dataPointIndex] ?? w.globals.labels?.[dataPointIndex] ?? this.formatChartDate(point.date);
          const volume = series[0]?.[dataPointIndex] ?? 0;

          return `
            <div class="rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-lg">
              <div class="text-xs font-medium text-zinc-500">${label}</div>
              <div class="mt-1 text-sm font-semibold text-zinc-950">${this.formatMoney(volume * 100, data.balance.currency)}</div>
              <div class="mt-0.5 text-xs text-zinc-500">${new Intl.NumberFormat('pt-BR').format(point.salesCount)} vendas aprovadas</div>
            </div>
          `;
        },
      },
    };
  });

  readonly linkConversionSummary = computed(() => {
    const conversion = this.overview()?.conversion;
    if (!conversion) {
      return {
        linksCreated: 0,
        linksPaid: 0,
        conversionRate: 0,
        conversionPercent: 0,
      };
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
      {
        label: 'Aprovadas',
        value: approved,
        colorClass: 'bg-emerald-500',
      },
      {
        label: 'Falhas',
        value: failed,
        colorClass: 'bg-red-500',
      },
      {
        label: 'Expiradas',
        value: expired,
        colorClass: 'bg-amber-500',
      },
      {
        label: 'Estornadas',
        value: refunded,
        colorClass: 'bg-indigo-500',
      },
      {
        label: 'Outros',
        value: other,
        colorClass: 'bg-zinc-400',
      },
    ]
      .filter((item) => item.value > 0)
      .map((item) => ({
        ...item,
        percent: (item.value / attempts) * 100,
      }));
  });

  readonly attentionItems = computed(() => {
    const attention = this.overview()?.attention;
    if (!attention) return [];

    return [
      { label: 'Webhooks falhos', value: attention.failedWebhookDeliveries, route: '/dashboard/webhooks' },
      { label: 'Webhooks pendentes', value: attention.pendingWebhookDeliveries, route: '/dashboard/webhooks' },
      { label: 'Alertas falhos', value: attention.failedAlertDeliveries, route: '/dashboard/alerts' },
      { label: 'Alertas pendentes', value: attention.pendingAlertDeliveries, route: '/dashboard/alerts' },
    ].filter((item) => item.value > 0);
  });

  readonly attentionTotal = computed(() => this.attentionItems().reduce((total, item) => total + item.value, 0));
  readonly isEmptyPeriod = computed(() => {
    const data = this.overview();
    if (!data) return false;

    return data.performance.salesCount === 0 && data.performance.netVolume === 0 && data.chart.every((item) => item.netVolume === 0 && item.salesCount === 0);
  });

  private requestId = 0;

  constructor() {
    effect(() => {
      const store = this.storeService.currentStore();
      const range = this.selectedRange();

      if (store && range.startDate && range.endDate) {
        this.loadOverview(range.startDate, range.endDate);
      }
    }, { allowSignalWrites: true });
  }

  setFilter(filter: PeriodFilter) {
    this.activeFilter.set(filter);
  }

  setCustomDateRange(value: [Date | undefined, Date | undefined] | null) {
    const [start, end] = value ?? [];
    this.customDateRange.set(start && end ? [start, end] : undefined);
    this.activeFilter.set('custom');
  }

  reload() {
    const range = this.selectedRange();
    if (!range.startDate || !range.endDate) return;
    this.loadOverview(range.startDate, range.endDate);
  }

  formattedPeriodRange(): string {
    const period = this.overview()?.period;
    const range = period ? { startDate: period.startDate, endDate: period.endDate } : this.selectedRange();

    return `${this.formatDate(range.startDate)} - ${this.formatDate(range.endDate)}`;
  }

  defaultCurrency(): string {
    return this.overview()?.balance.currency || 'BRL';
  }

  deltaClass(delta: number | null): string {
    if (delta === null) return 'text-zinc-400';
    if (delta > 0) return 'text-emerald-600';
    if (delta < 0) return 'text-red-600';
    return 'text-zinc-500';
  }

  formatDelta(delta: number): string {
    const prefix = delta > 0 ? '+' : '';
    return `${prefix}${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(delta * 100)}%`;
  }

  formatRate(value: number): string {
    return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(this.ratePercent(value))}%`;
  }

  ratePercent(value: number): number {
    return Math.max(0, Math.min(100, (value || 0) * 100));
  }

  private paymentStatusCount(statuses: string[]): number {
    const normalized = new Set(statuses.map((status) => status.toUpperCase()));

    return this.overview()?.paymentStatusBreakdown
      .filter((item) => normalized.has(item.status.toUpperCase()))
      .reduce((total, item) => total + item.count, 0) ?? 0;
  }

  statusLabel(status: string): string {
    const normalized = status.toUpperCase();
    const labels: Record<string, string> = {
      PAID: 'Pago',
      APPROVED: 'Aprovado',
      PENDING: 'Pendente',
      PROCESSING: 'Processando',
      FAILED: 'Falhou',
      EXPIRED: 'Expirado',
      REFUNDED: 'Estornado',
      CANCELLED: 'Cancelado',
      CANCELED: 'Cancelado',
    };

    return labels[normalized] ?? status;
  }

  statusClass(status: string): string {
    const normalized = status.toUpperCase();
    if (['PAID', 'APPROVED'].includes(normalized)) return 'bg-emerald-50 text-emerald-700';
    if (['PENDING', 'PROCESSING'].includes(normalized)) return 'bg-amber-50 text-amber-700';
    if (['FAILED', 'EXPIRED', 'CANCELLED', 'CANCELED'].includes(normalized)) return 'bg-red-50 text-red-700';
    if (normalized === 'REFUNDED') return 'bg-indigo-50 text-indigo-700';
    return 'bg-zinc-100 text-zinc-700';
  }

  originLabel(origin: DashboardOverviewResponse['recentPayments'][number]['origin']): string {
    const labels: Record<DashboardOverviewResponse['recentPayments'][number]['origin'], string> = {
      api: 'API',
      checkout: 'Checkout',
      payment_link: 'Link',
      unknown: 'Origem desconhecida',
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

    this.dashboardService.getOverview(this.startOfDayIso(startDate), this.endOfDayIso(endDate)).subscribe({
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
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(this.parseDate(value));
  }

  private formatDisplayDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  private formatChartDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(this.parseDate(value));
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
