import { Component, inject, computed, signal, OnInit, effect } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { DashboardService, DashboardMetricsResponse } from '../../../../core/services/dashboard.service';
import { NgApexchartsModule } from 'ng-apexcharts';
import { StoreService } from '../../../../core/services/store.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { lucideWallet, lucideActivity, lucideCreditCard, lucideTrendingUp, lucideLineChart } from '@ng-icons/lucide';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexStroke,
  ApexDataLabels,
  ApexYAxis,
  ApexTooltip,
  ApexFill,
  ApexGrid,
  ApexMarkers
} from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  yaxis: ApexYAxis;
  tooltip: ApexTooltip;
  fill: ApexFill;
  grid: ApexGrid;
  colors: string[];
  markers: ApexMarkers;
};

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, CurrencyPipe, NgIconComponent, HlmIconImports],
  viewProviders: [provideIcons({ lucideWallet, lucideActivity, lucideCreditCard, lucideTrendingUp, lucideLineChart })],
  template: `
    <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-10">
      <!-- Page Header & Filters -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Visão Geral</h1>
          <p class="text-sm text-zinc-500 mt-1">Acompanhe as métricas e o desempenho da sua loja em tempo real.</p>
        </div>
        
        <!-- Filters -->
        <div class="inline-flex bg-zinc-100/80 rounded-lg p-1 border border-zinc-200/50 shadow-sm">
          <button 
            (click)="setFilter('today')"
            [class.bg-white]="activeFilter() === 'today'"
            [class.shadow-sm]="activeFilter() === 'today'"
            [class.text-zinc-900]="activeFilter() === 'today'"
            [class.text-zinc-500]="activeFilter() !== 'today'"
            class="px-4 py-1.5 text-sm font-medium rounded-md transition-all">
            Hoje
          </button>
          <button 
            (click)="setFilter('7days')"
            [class.bg-white]="activeFilter() === '7days'"
            [class.shadow-sm]="activeFilter() === '7days'"
            [class.text-zinc-900]="activeFilter() === '7days'"
            [class.text-zinc-500]="activeFilter() !== '7days'"
            class="px-4 py-1.5 text-sm font-medium rounded-md transition-all hover:text-zinc-700">
            Últimos 7 dias
          </button>
          <button 
            (click)="setFilter('30days')"
            [class.bg-white]="activeFilter() === '30days'"
            [class.shadow-sm]="activeFilter() === '30days'"
            [class.text-zinc-900]="activeFilter() === '30days'"
            [class.text-zinc-500]="activeFilter() !== '30days'"
            class="px-4 py-1.5 text-sm font-medium rounded-md transition-all hover:text-zinc-700">
            Últimos 30 dias
          </button>
        </div>
      </div>

      @if (isLoading()) {
        <!-- Premium Skeletons -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          @for (i of [1,2,3,4]; track i) {
            <div class="bg-white rounded-xl border border-zinc-200/80 p-6 shadow-sm flex flex-col justify-between">
              <div class="flex items-center justify-between mb-4 animate-pulse">
                <div class="h-4 bg-zinc-200/80 rounded w-24"></div>
                <div class="w-8 h-8 rounded-lg bg-zinc-100"></div>
              </div>
              <div class="h-8 bg-zinc-200/80 rounded w-32 animate-pulse mt-2"></div>
            </div>
          }
        </div>
        <div class="bg-white rounded-xl border border-zinc-200/80 p-6 shadow-sm h-[400px] flex items-center justify-center">
          <div class="h-full w-full bg-zinc-100/50 rounded-lg animate-pulse"></div>
        </div>
      } @else if (metrics()) {
        <!-- Metrics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Balance -->
          <div class="bg-white rounded-xl border border-zinc-200/80 p-6 shadow-sm flex flex-col justify-between hover:border-indigo-500/30 transition-colors group relative overflow-hidden">
            <div class="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-indigo-50 to-transparent opacity-50 rounded-bl-full pointer-events-none transition-opacity group-hover:opacity-100"></div>
            <div class="flex items-center justify-between mb-3 relative z-10">
              <h3 class="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Saldo Atual</h3>
              <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center ring-1 ring-indigo-100/50 group-hover:scale-110 transition-transform">
                <ng-icon hlm name="lucideWallet" size="sm"></ng-icon>
              </div>
            </div>
            <p class="text-[1.75rem] font-bold tracking-tight text-zinc-900 relative z-10">{{ (metrics()!.currentBalance.available / 100) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</p>
          </div>
          
          <!-- Total Volume -->
          <div class="bg-white rounded-xl border border-zinc-200/80 p-6 shadow-sm flex flex-col justify-between hover:border-indigo-500/30 transition-colors group relative overflow-hidden">
            <div class="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-emerald-50 to-transparent opacity-50 rounded-bl-full pointer-events-none transition-opacity group-hover:opacity-100"></div>
            <div class="flex items-center justify-between mb-3 relative z-10">
              <h3 class="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Vol. Processado</h3>
              <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-100/50 group-hover:scale-110 transition-transform">
                <ng-icon hlm name="lucideActivity" size="sm"></ng-icon>
              </div>
            </div>
            <p class="text-[1.75rem] font-bold tracking-tight text-zinc-900 relative z-10">{{ (metrics()!.processing.totalVolume / 100) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</p>
          </div>

          <!-- Ticket Médio -->
          <div class="bg-white rounded-xl border border-zinc-200/80 p-6 shadow-sm flex flex-col justify-between hover:border-indigo-500/30 transition-colors group relative overflow-hidden">
            <div class="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-amber-50 to-transparent opacity-50 rounded-bl-full pointer-events-none transition-opacity group-hover:opacity-100"></div>
            <div class="flex items-center justify-between mb-3 relative z-10">
               <h3 class="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Ticket Médio</h3>
               <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center ring-1 ring-amber-100/50 group-hover:scale-110 transition-transform">
                 <ng-icon hlm name="lucideTrendingUp" size="sm"></ng-icon>
               </div>
            </div>
            <p class="text-[1.75rem] font-bold tracking-tight text-zinc-900 relative z-10">{{ (metrics()!.processing.averageTicket / 100) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</p>
          </div>

          <!-- Vendas -->
          <div class="bg-white rounded-xl border border-zinc-200/80 p-6 shadow-sm flex flex-col justify-between hover:border-indigo-500/30 transition-colors group relative overflow-hidden">
            <div class="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-transparent opacity-50 rounded-bl-full pointer-events-none transition-opacity group-hover:opacity-100"></div>
            <div class="flex items-center justify-between mb-3 relative z-10">
               <h3 class="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Qtd. Vendas</h3>
               <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center ring-1 ring-blue-100/50 group-hover:scale-110 transition-transform">
                 <ng-icon hlm name="lucideCreditCard" size="sm"></ng-icon>
               </div>
            </div>
            <p class="text-[1.75rem] font-bold tracking-tight text-zinc-900 relative z-10 flex items-end gap-2">
              {{ metrics()!.processing.salesCount }}
              <span class="text-sm font-normal text-zinc-400 mb-1.5 lowercase">transações</span>
            </p>
          </div>
        </div>

        <!-- Chart -->
        <div class="bg-white rounded-xl border border-zinc-200/80 shadow-sm flex flex-col min-h-[450px]">
          <div class="p-6 pb-4 border-b border-zinc-100/80 flex items-center justify-between bg-zinc-50/30 rounded-t-xl">
             <div class="flex items-center gap-3">
               <div class="w-10 h-10 rounded-lg bg-white border border-zinc-200/60 flex items-center justify-center shadow-sm">
                 <ng-icon hlm name="lucideLineChart" class="text-indigo-600 text-lg"></ng-icon>
               </div>
               <div>
                 <h3 class="text-base font-bold tracking-tight text-zinc-900">Volume Financeiro Diário</h3>
                 <p class="text-sm text-zinc-500 mt-0.5">Vendas líquidas processadas por dia no período.</p>
               </div>
             </div>
          </div>
          
          <div class="p-6 flex-1 relative flex flex-col">
            @if (metrics()?.processing?.salesCount === 0) {
               <!-- Elegant Empty State -->
               <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-white rounded-b-xl">
                 <div class="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-5 shadow-sm">
                   <ng-icon hlm name="lucideLineChart" size="xl" class="text-indigo-600 opacity-80" strokeWidth="1.5"></ng-icon>
                 </div>
                 <h3 class="text-base font-semibold text-zinc-900 mb-1.5">Ainda não há dados para exibição</h3>
                 <p class="text-sm text-zinc-500 max-w-sm mt-1 mb-6">
                   Você ainda não processou vendas neste período. Volte aqui em breve para visualizar as métricas do seu crescimento.
                 </p>
               </div>
            } @else {
               <div class="-mx-2 -mb-2 mt-2 flex-1 relative min-h-[350px]">
                 @if (chartOptions() && chartOptions()!.series) {
                   <apx-chart
                     style="display: block; width: 100%; height: 100%;"
                     [series]="chartOptions()!.series!"
                     [chart]="chartOptions()!.chart!"
                     [xaxis]="chartOptions()!.xaxis!"
                     [yaxis]="chartOptions()!.yaxis!"
                     [dataLabels]="chartOptions()!.dataLabels!"
                     [grid]="chartOptions()!.grid!"
                     [stroke]="chartOptions()!.stroke!"
                     [tooltip]="chartOptions()!.tooltip!"
                     [colors]="chartOptions()!.colors!"
                     [fill]="chartOptions()!.fill!"
                     [markers]="chartOptions()!.markers!"
                   ></apx-chart>
                 }
               </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class Overview implements OnInit {
  private dashboardService = inject(DashboardService);
  private storeService = inject(StoreService);

  metrics = signal<DashboardMetricsResponse | null>(null);
  isLoading = signal(true);
  activeFilter = signal<'today' | '7days' | '30days'>('30days');

  chartOptions = computed<Partial<ChartOptions>>(() => {
    const data = this.metrics();
    if (!data || data.processing.salesCount === 0) return {};

    const categories = data.chartData.map(item => {
      // Format YYYY-MM-DD to DD/MM
      const parts = item.date.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      return item.date;
    });

    // Convert to reais
    const seriesData = data.chartData.map(item => item.volume / 100);

    return {
      series: [
        {
          name: "Volume",
          data: seriesData
        }
      ],
      chart: {
        type: "area",
        height: 350,
        toolbar: { show: false },
        fontFamily: 'Inter, sans-serif'
      },
      colors: ['#4f46e5'], // indigo-600
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: "smooth",
        width: 2
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.35,
          opacityTo: 0.05,
          stops: [0, 90, 100]
        }
      },
      markers: {
        size: 5,
        colors: ['#ffffff'],
        strokeColors: '#4f46e5',
        strokeWidth: 2,
        hover: {
          size: 7
        }
      },
      xaxis: {
        categories: categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: {
            colors: '#71717a' // zinc-500
          }
        },
        tooltip: {
          enabled: true,
          style: {
            fontFamily: 'Inter, sans-serif'
          }
        }
      },
      yaxis: {
        labels: {
          formatter: (value) => {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
          },
          style: {
            colors: '#71717a'
          }
        }
      },
      grid: {
        borderColor: '#f4f4f5', // zinc-100
        strokeDashArray: 0,
        padding: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 10
        },
        yaxis: {
          lines: { show: true }
        },
        xaxis: {
          lines: { show: false }
        }
      },
      tooltip: {
        enabled: true,
        shared: true,
        intersect: false,
        custom: function ({ series, seriesIndex, dataPointIndex, w }) {
          const value = series[seriesIndex][dataPointIndex];
          const date = w.globals.categoryLabels[dataPointIndex];
          const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

          return `
            <div class="bg-white border border-zinc-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-xl overflow-hidden font-sans min-w-[160px]">
              <div class="bg-zinc-50/80 px-4 py-2 border-b border-zinc-100/80 flex justify-between items-center">
                <span class="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Período</span>
                <span class="text-[11px] font-bold text-zinc-700">${date}</span>
              </div>
              <div class="px-4 py-3.5 bg-white flex items-center gap-3">
                <div class="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-indigo-50"></div>
                <div class="flex flex-col">
                  <span class="text-[11px] text-zinc-400 font-medium mb-0.5 uppercase tracking-wide">Volume</span>
                  <span class="text-sm font-bold text-zinc-900">${formattedValue}</span>
                </div>
              </div>
            </div>
          `;
        }
      }
    };
  });

  constructor() {
    // React to store changes by reloading metrics
    effect(() => {
      const store = this.storeService.currentStore();
      // Only load if we have a valid store selected
      if (store) {
        this.loadMetrics();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    // The effect above perfectly handles the initial load when the store becomes available. 
    // We remove the duplicate/racing call here.
  }

  setFilter(filter: 'today' | '7days' | '30days') {
    this.activeFilter.set(filter);

    // In a real scenario, we would parse dates here and call loadMetrics with them.
    // For now, it stays fixed to 30 days on the backend, serving as visual only.
  }

  loadMetrics() {
    this.isLoading.set(true);
    // Fixed param payload mimicking frontend mockup bounds
    this.dashboardService.getMetrics().subscribe({
      next: (data) => {
        this.metrics.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard metrics', err);
        // Fallback or empty state could be handled here
        this.isLoading.set(false);
      }
    });
  }
}
