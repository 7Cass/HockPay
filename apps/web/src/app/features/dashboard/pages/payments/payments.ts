import { Component, inject, OnInit } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PaymentService, PaymentStatus } from '../../../../core/services/payment.service';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { provideIcons } from '@ng-icons/core';
import {
  lucideFilter,
  lucideDownload,
  lucideRefreshCcw,
  lucideCheckCircle2,
  lucideClock,
  lucideXCircle,
  lucideArrowRightLeft,
  lucideReceipt
} from '@ng-icons/lucide';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [DatePipe, CurrencyPipe, RouterLink, HlmTableImports, HlmBadgeImports, HlmSpinnerImports, HlmButtonImports, HlmIconImports],
  providers: [
    provideIcons({
      lucideFilter,
      lucideDownload,
      lucideRefreshCcw,
      lucideCheckCircle2,
      lucideClock,
      lucideXCircle,
      lucideArrowRightLeft,
      lucideReceipt
    })
  ],
  template: `
    <div class="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-10">
      
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Pagamentos</h1>
          <p class="text-sm text-zinc-500 mt-1">Acompanhe todas as transações, taxas e recebimentos da sua loja.</p>
        </div>
        
        <div class="flex items-center gap-3">
          <button hlmBtn variant="outline" size="sm" class="gap-2 bg-white border-zinc-200/80 shadow-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900" (click)="paymentService.loadPayments()">
            <ng-icon hlm name="lucideRefreshCcw" size="xs"></ng-icon>
            Atualizar
          </button>
          <button hlmBtn variant="outline" size="sm" class="gap-2 bg-white border-zinc-200/80 shadow-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">
            <ng-icon hlm name="lucideFilter" size="xs"></ng-icon>
            Filtrar
          </button>
          <button hlmBtn size="sm" class="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border border-transparent">
            <ng-icon hlm name="lucideDownload" size="xs"></ng-icon>
            Exportar
          </button>
        </div>
      </div>

      <!-- Error State -->
      @if (paymentService.error()) {
        <div class="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200/60 shadow-sm flex items-start gap-3">
          <ng-icon hlm name="lucideXCircle" class="mt-0.5 text-red-500"></ng-icon>
          <div class="flex-1">
            <h3 class="text-sm font-semibold">Erro ao carregar pagamentos</h3>
            <p class="text-sm mt-1 opacity-90">{{ paymentService.error() }}</p>
          </div>
        </div>
      }

      <div class="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-sm flex flex-col min-h-[400px]">
        <!-- Loading State -->
        @if (paymentService.isLoading()) {
          <div class="flex-1 flex flex-col justify-center items-center py-24">
            <hlm-spinner class="w-6 h-6 text-indigo-600 animate-spin"/>
            <p class="text-sm text-zinc-500 mt-4 font-medium">Buscando transações...</p>
          </div>
        }

        <!-- Empty State -->
        @if (!paymentService.isLoading() && !paymentService.error() && paymentService.payments().length === 0) {
          <div class="flex-1 flex flex-col items-center justify-center py-24 text-center px-6 bg-zinc-50/30">
            <div class="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-5 shadow-sm">
              <ng-icon hlm name="lucideReceipt" size="xl" class="text-indigo-600 opacity-80" strokeWidth="1.5"></ng-icon>
            </div>
            <h3 class="text-base font-semibold text-zinc-900 mb-1.5">Nenhum pagamento encontrado</h3>
            <p class="text-sm text-zinc-500 max-w-sm mx-auto">Não há registros de transações no período selecionado. Quando houver vendas, elas aparecerão aqui.</p>
          </div>
        }

        <!-- Table View -->
        @if (!paymentService.isLoading() && paymentService.payments().length > 0) {
          <div class="flex-1 overflow-x-auto">
            <table hlmTable class="w-full">
              <thead hlmTHead class="bg-zinc-50/50 border-b border-zinc-200/80">
                <tr hlmTr class="border-none hover:bg-transparent">
                  <th hlmTh class="w-[140px] font-semibold text-xs text-zinc-500 uppercase tracking-wider py-3.5 pl-6">Data & Hora</th>
                  <th hlmTh class="flex-1 font-semibold text-xs text-zinc-500 uppercase tracking-wider py-3.5">Descrição</th>
                  <th hlmTh class="font-semibold text-xs text-zinc-500 uppercase tracking-wider py-3.5 text-right">Bruto</th>
                  <th hlmTh class="font-semibold text-xs text-zinc-500 uppercase tracking-wider py-3.5 text-right text-red-500/80 hidden sm:table-cell">Taxa</th>
                  <th hlmTh class="font-semibold text-xs text-zinc-500 uppercase tracking-wider py-3.5 text-right pr-6">Líquido</th>
                  <th hlmTh class="w-[130px] font-semibold text-xs text-zinc-500 uppercase tracking-wider py-3.5 text-center">Status</th>
                </tr>
              </thead>
              
              <tbody hlmTBody class="divide-y divide-zinc-100">
                @for (payment of paymentService.payments(); track payment.id) {
                  <tr hlmTr [routerLink]="['/dashboard/payments', payment.id]" class="hover:bg-zinc-50/80 transition-colors border-none group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                    <td hlmTd class="py-3.5 pl-6">
                      <div class="flex flex-col">
                        <span class="text-sm font-medium text-zinc-900">{{ payment.createdAt | date:'dd/MM/yyyy' }}</span>
                        <span class="text-xs text-zinc-400 mt-0.5">{{ payment.createdAt | date:'HH:mm' }}</span>
                      </div>
                    </td>
                    <td hlmTd class="py-3.5">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200/60 flex items-center justify-center flex-shrink-0 text-zinc-500 group-hover:bg-white group-hover:border-zinc-300 group-hover:shadow-sm transition-all">
                          <ng-icon hlm name="lucideArrowRightLeft" size="sm" strokeWidth="1.5"></ng-icon>
                        </div>
                        <div class="flex flex-col">
                          <span class="text-sm font-medium text-zinc-800">{{ payment.description || 'Pagamento Online' }}</span>
                          <span class="text-xs text-zinc-400 mt-0.5 font-mono">{{ payment.id.split('-')[0] }}...</span>
                        </div>
                      </div>
                    </td>
                    <td hlmTd class="py-3.5 text-right">
                      <span class="text-sm text-zinc-600 font-medium">{{ payment.amount / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                    </td>
                    <td hlmTd class="py-3.5 text-right hidden sm:table-cell">
                      <span class="text-sm text-red-500/80 font-medium">-{{ payment.fee / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                    </td>
                    <td hlmTd class="py-3.5 text-right pr-6">
                      <span class="text-sm font-semibold text-emerald-600">{{ payment.netAmount / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                    </td>
                    <td hlmTd class="py-3.5 text-center px-4">
                      <!-- Custom Styled Badges for Premium Look -->
                      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors" [class]="getPremiumBadgeClasses(payment.status)">
                        <ng-icon hlm [name]="getStatusIcon(payment.status)" size="xs"></ng-icon>
                        {{ formatStatus(payment.status) }}
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          
          <!-- Elegant Footer -->
          <div class="px-6 py-4 border-t border-zinc-200/80 bg-zinc-50/50 text-xs text-zinc-500 flex justify-between items-center rounded-b-xl">
            <span class="flex items-center gap-1.5">
              Exibindo <span class="font-semibold text-zinc-700 bg-white border border-zinc-200 px-1.5 py-0.5 rounded shadow-sm">{{ paymentService.payments().length }}</span> registros
            </span>
            <span class="flex items-center gap-2">
              Total base: 
              <span class="font-semibold text-zinc-900">{{ paymentService.total() }}</span>
            </span>
          </div>
        }
      </div>
  `
})
export class Payments implements OnInit {
  public paymentService = inject(PaymentService);

  ngOnInit() {
    this.paymentService.loadPayments();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  }

  // Custom Status Styling logic replacing standard badges for a high-end feel
  getPremiumBadgeClasses(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.CONFIRMED:
      case PaymentStatus.RELEASED:
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
      case PaymentStatus.PENDING:
        return 'bg-amber-50 text-amber-700 border border-amber-200/60';
      case PaymentStatus.FAILED:
      case PaymentStatus.EXPIRED:
      case PaymentStatus.REFUNDED:
        return 'bg-red-50 text-red-700 border border-red-200/60';
      default:
        return 'bg-zinc-100 text-zinc-700 border border-zinc-200/60';
    }
  }

  getStatusIcon(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.CONFIRMED:
      case PaymentStatus.RELEASED:
        return 'lucideCheckCircle2';
      case PaymentStatus.PENDING:
        return 'lucideClock';
      case PaymentStatus.FAILED:
      case PaymentStatus.EXPIRED:
      case PaymentStatus.REFUNDED:
        return 'lucideXCircle';
      default:
        return 'lucideRefreshCcw';
    }
  }

  formatStatus(status: PaymentStatus): string {
    const map: Record<string, string> = {
      PENDING: 'Pendente',
      CONFIRMED: 'Confirmado',
      RELEASED: 'Liquidado',
      FAILED: 'Falhou',
      EXPIRED: 'Expirado',
      REFUNDED: 'Estornado',
    };
    return map[status] || status;
  }
}
