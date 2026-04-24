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
    <div class="flex flex-col gap-8 max-w-7xl mx-auto w-full pb-10 font-sans">
      <!-- Page Header & Filters -->
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight text-zinc-950">Overview</h1>
          <p class="text-sm text-zinc-500 mt-1">Real-time metrics and performance.</p>
        </div>
        
        <!-- Filters -->
        <div class="inline-flex bg-zinc-100/50 rounded-lg p-1 border border-zinc-200/50">
          <button 
            (click)="setFilter('today')"
            [class.bg-white]="activeFilter() === 'today'"
            [class.shadow-sm]="activeFilter() === 'today'"
            [class.text-zinc-950]="activeFilter() === 'today'"
            [class.text-zinc-500]="activeFilter() !== 'today'"
            class="px-5 py-1.5 text-sm font-medium rounded-md transition-all">
            Today
          </button>
          <button 
            (click)="setFilter('7days')"
            [class.bg-white]="activeFilter() === '7days'"
            [class.shadow-sm]="activeFilter() === '7days'"
            [class.text-zinc-950]="activeFilter() === '7days'"
            [class.text-zinc-500]="activeFilter() !== '7days'"
            class="px-5 py-1.5 text-sm font-medium rounded-md transition-all">
            7D
          </button>
          <button 
            (click)="setFilter('30days')"
            [class.bg-white]="activeFilter() === '30days'"
            [class.shadow-sm]="activeFilter() === '30days'"
            [class.text-zinc-950]="activeFilter() === '30days'"
            [class.text-zinc-500]="activeFilter() !== '30days'"
            class="px-5 py-1.5 text-sm font-medium rounded-md transition-all">
            30D
          </button>
        </div>
      </div>

      @if (isLoading()) {
        <!-- Minimal Skeletons -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          @for (i of [1,2,3,4]; track i) {
            <div class="bg-white rounded-xl border border-zinc-200/60 p-6 flex flex-col justify-between">
              <div class="h-4 bg-zinc-100 rounded w-20 mb-6 animate-pulse"></div>
              <div class="h-8 bg-zinc-100 rounded w-32 animate-pulse"></div>
            </div>
          }
        </div>
        <div class="bg-white rounded-xl border border-zinc-200/60 p-6 h-[400px] flex items-center justify-center">
          <div class="h-full w-full bg-zinc-50/50 rounded-lg animate-pulse"></div>
        </div>
      } @else if (metrics()) {
        <!-- Metrics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Balance -->
          <div class="bg-white rounded-xl border border-zinc-200/60 p-6 flex flex-col justify-between transition-all hover:border-zinc-300 hover:shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xs font-medium text-zinc-500 uppercase tracking-widest">Saldo Atual</h3>
              <ng-icon hlm name="lucideWallet" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="text-3xl font-semibold tracking-tight text-zinc-950">{{ (metrics()!.currentBalance.available / 100) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</p>
          </div>
          
          <!-- Total Volume -->
          <div class="bg-white rounded-xl border border-zinc-200/60 p-6 flex flex-col justify-between transition-all hover:border-zinc-300 hover:shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xs font-medium text-zinc-500 uppercase tracking-widest">Vol. Processado</h3>
              <ng-icon hlm name="lucideActivity" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="text-3xl font-semibold tracking-tight text-zinc-950">{{ (metrics()!.processing.totalVolume / 100) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</p>
          </div>

          <!-- Ticket Médio -->
          <div class="bg-white rounded-xl border border-zinc-200/60 p-6 flex flex-col justify-between transition-all hover:border-zinc-300 hover:shadow-sm">
            <div class="flex items-center justify-between mb-4">
               <h3 class="text-xs font-medium text-zinc-500 uppercase tracking-widest">Ticket Médio</h3>
               <ng-icon hlm name="lucideTrendingUp" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="text-3xl font-semibold tracking-tight text-zinc-950">{{ (metrics()!.processing.averageTicket / 100) | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</p>
          </div>

          <!-- Vendas -->
          <div class="bg-white rounded-xl border border-zinc-200/60 p-6 flex flex-col justify-between transition-all hover:border-zinc-300 hover:shadow-sm">
            <div class="flex items-center justify-between mb-4">
               <h3 class="text-xs font-medium text-zinc-500 uppercase tracking-widest">Qtd. Vendas</h3>
               <ng-icon hlm name="lucideCreditCard" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="text-3xl font-semibold tracking-tight text-zinc-950 flex items-baseline gap-1.5">
              {{ metrics()!.processing.salesCount }}
              <span class="text-sm font-medium text-zinc-400">transações</span>
            </p>
          </div>
        </div>

        <!-- Chart -->
        <div class="bg-white rounded-xl border border-zinc-200/60 flex flex-col min-h-[450px] mt-2">
          <div class="p-6 pb-2">
             <h3 class="text-base font-semibold tracking-tight text-zinc-950">Volume Financeiro</h3>
          </div>
          
          <div class="p-4 flex-1 relative flex flex-col">
            @if (metrics()?.processing?.salesCount === 0) {
               <!-- Minimal Empty State -->
               <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                 <p class="text-sm text-zinc-500">Sem dados no período selecionado.</p>
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
      const parts = item.date.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      return item.date;
    });

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
      colors: ['#09090b'], // zinc-950
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
          opacityFrom: 0.1,
          opacityTo: 0.0,
          stops: [0, 100]
        }
      },
      markers: {
        size: 0,
        hover: {
          size: 4,
          colors: ['#09090b']
        }
      },
      xaxis: {
        categories: categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: {
            colors: '#a1a1aa' // zinc-400
          }
        },
        tooltip: {
          enabled: false
        }
      },
      yaxis: {
        labels: {
          formatter: (value) => {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
          },
          style: {
            colors: '#a1a1aa'
          }
        }
      },
      grid: {
        borderColor: '#f4f4f5', // zinc-100
        strokeDashArray: 4,
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
        theme: 'light',
        custom: function ({ series, seriesIndex, dataPointIndex, w }) {
          const value = series[seriesIndex][dataPointIndex];
          const date = w.globals.categoryLabels[dataPointIndex];
          const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

          return `
            <div class="bg-white border border-zinc-200 shadow-sm rounded-lg overflow-hidden font-sans min-w-[140px]">
              <div class="px-3 py-2 border-b border-zinc-100 flex justify-between items-center">
                <span class="text-xs font-medium text-zinc-500">${date}</span>
              </div>
              <div class="px-3 py-2 flex flex-col">
                <span class="text-[10px] text-zinc-400 uppercase tracking-widest font-medium mb-1">Volume</span>
                <span class="text-sm font-semibold text-zinc-950">${formattedValue}</span>
              </div>
            </div>
          `;
        }
      }
    };
  });

  constructor() {
    effect(() => {
      const store = this.storeService.currentStore();
      if (store) {
        this.loadMetrics();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {}

  setFilter(filter: 'today' | '7days' | '30days') {
    this.activeFilter.set(filter);
  }

  loadMetrics() {
    this.isLoading.set(true);
    this.dashboardService.getMetrics().subscribe({
      next: (data) => {
        this.metrics.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard metrics', err);
        this.isLoading.set(false);
      }
    });
  }
}
