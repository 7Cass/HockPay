import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PaymentService, PaymentStatus, ListPaymentsQueryDto } from '../../../../core/services/payment.service';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCcw,
  lucideCheckCircle2,
  lucideClock,
  lucideXCircle,
  lucideArrowRightLeft,
  lucideReceipt,
  lucideLink,
  lucideSearch,
  lucideChevronLeft,
  lucideChevronRight
} from '@ng-icons/lucide';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [DatePipe, CurrencyPipe, RouterLink, HlmTableImports, HlmBadgeImports, HlmSpinnerImports, HlmButtonImports, HlmIconImports],
  providers: [
    provideIcons({
      lucideRefreshCcw,
      lucideCheckCircle2,
      lucideClock,
      lucideXCircle,
      lucideArrowRightLeft,
      lucideReceipt,
      lucideLink,
      lucideSearch,
      lucideChevronLeft,
      lucideChevronRight
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
          <button hlmBtn variant="outline" size="sm" class="gap-2 bg-white border-zinc-200/80 shadow-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900" (click)="reload()">
            <ng-icon hlm name="lucideRefreshCcw" size="xs"></ng-icon>
            Atualizar
          </button>
        </div>
      </div>

      <section class="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div class="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto]">
          <label class="text-sm font-medium text-zinc-700">
            <span class="mb-1.5 block">Busca</span>
            <div class="relative">
              <ng-icon hlm name="lucideSearch" size="xs" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"></ng-icon>
              <input
                class="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                placeholder="External ID"
                [value]="search()"
                (input)="setSearch($event)"
                (keydown.enter)="applyFilters()"
              />
            </div>
          </label>

          <label class="text-sm font-medium text-zinc-700">
            <span class="mb-1.5 block">Status</span>
            <select class="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" [value]="status()" (change)="setStatus($event)">
              @for (option of statusOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </label>

          <label class="text-sm font-medium text-zinc-700">
            <span class="mb-1.5 block">Início</span>
            <input type="date" class="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" [value]="startDate()" (input)="setStartDate($event)" />
          </label>

          <label class="text-sm font-medium text-zinc-700">
            <span class="mb-1.5 block">Fim</span>
            <input type="date" class="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" [value]="endDate()" (input)="setEndDate($event)" />
          </label>

          <div class="flex items-end gap-2">
            <button hlmBtn type="button" variant="outline" class="h-10 border-zinc-200 bg-white" (click)="clearFilters()">Limpar</button>
            <button hlmBtn type="button" class="h-10 gap-2 bg-indigo-600 text-white hover:bg-indigo-700" (click)="applyFilters()">
              <ng-icon hlm name="lucideSearch" size="xs"></ng-icon>
              Filtrar
            </button>
          </div>
        </div>
      </section>

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
            <p class="text-sm text-zinc-500 max-w-sm mx-auto">{{ emptyStateMessage() }}</p>
            @if (hasActiveFilters()) {
              <button hlmBtn type="button" variant="outline" size="sm" class="mt-5 border-zinc-200 bg-white" (click)="clearFilters()">Limpar filtros</button>
            }
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
                          @if (isPaymentLinkAttempt(payment)) {
                            <div class="mt-2 flex flex-wrap items-center gap-1.5">
                              <span class="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                                <ng-icon hlm name="lucideLink" size="xs"></ng-icon>
                                Link
                              </span>
                              <span class="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                                {{ formatAttempt(payment) }}
                              </span>
                              <span class="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-zinc-500">
                                {{ shortId(payment.pixChargeId || payment.paymentLinkId) }}
                              </span>
                            </div>
                          }
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
          <div class="px-6 py-4 border-t border-zinc-200/80 bg-zinc-50/50 text-xs text-zinc-500 flex flex-col gap-3 rounded-b-xl sm:flex-row sm:items-center sm:justify-between">
            <span class="flex items-center gap-1.5">
              Exibindo <span class="font-semibold text-zinc-700 bg-white border border-zinc-200 px-1.5 py-0.5 rounded shadow-sm">{{ paymentService.payments().length }}</span> de <span class="font-semibold text-zinc-700">{{ paymentService.total() }}</span> registros
            </span>
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-2">
                <span>Por página</span>
                <select class="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs" [value]="limit()" (change)="setLimit($event)">
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </label>
              <button hlmBtn type="button" variant="outline" size="sm" class="h-8 border-zinc-200 bg-white" [disabled]="paymentService.page() <= 1" (click)="changePage(-1)">
                <ng-icon hlm name="lucideChevronLeft" size="xs"></ng-icon>
                Anterior
              </button>
              <span class="font-medium text-zinc-600">Página {{ paymentService.page() }} de {{ paymentService.totalPages() }}</span>
              <button hlmBtn type="button" variant="outline" size="sm" class="h-8 border-zinc-200 bg-white" [disabled]="paymentService.page() >= paymentService.totalPages()" (click)="changePage(1)">
                Próxima
                <ng-icon hlm name="lucideChevronRight" size="xs"></ng-icon>
              </button>
            </div>
          </div>
        }
      </div>
  `
})
export class Payments implements OnInit, OnDestroy {
  public paymentService = inject(PaymentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private routeSub?: Subscription;

  readonly search = signal('');
  readonly status = signal<PaymentStatus | 'all'>('all');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly statusOptions: Array<{ value: PaymentStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: PaymentStatus.PENDING, label: 'Pendente' },
    { value: PaymentStatus.CONFIRMED, label: 'Confirmado' },
    { value: PaymentStatus.RELEASED, label: 'Liquidado' },
    { value: PaymentStatus.FAILED, label: 'Falhou' },
    { value: PaymentStatus.EXPIRED, label: 'Expirado' },
    { value: PaymentStatus.REFUNDED, label: 'Estornado' },
  ];

  ngOnInit() {
    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      const status = params.get('status');
      const page = this.parsePositiveInt(params.get('page'), 1);
      const limit = this.parsePositiveInt(params.get('limit'), 20);

      this.search.set(params.get('q') ?? '');
      this.status.set(this.parseStatus(status));
      this.startDate.set(params.get('startDate') ?? '');
      this.endDate.set(params.get('endDate') ?? '');
      this.page.set(page);
      this.limit.set(limit);
      this.loadCurrentQuery();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  reload(): void {
    this.loadCurrentQuery();
  }

  setSearch(event: Event): void {
    this.search.set(this.eventValue(event));
  }

  setStatus(event: Event): void {
    this.status.set(this.parseStatus(this.eventValue(event)));
  }

  setStartDate(event: Event): void {
    this.startDate.set(this.eventValue(event));
  }

  setEndDate(event: Event): void {
    this.endDate.set(this.eventValue(event));
  }

  setLimit(event: Event): void {
    this.limit.set(this.parsePositiveInt(this.eventValue(event), 20));
    this.updateQueryParams(1);
  }

  applyFilters(): void {
    this.updateQueryParams(1);
  }

  clearFilters(): void {
    this.search.set('');
    this.status.set('all');
    this.startDate.set('');
    this.endDate.set('');
    this.limit.set(20);
    this.updateQueryParams(1);
  }

  changePage(delta: number): void {
    const nextPage = this.page() + delta;
    if (nextPage < 1 || nextPage > this.paymentService.totalPages()) return;
    this.updateQueryParams(nextPage);
  }

  hasActiveFilters(): boolean {
    return Boolean(this.search().trim() || this.status() !== 'all' || this.startDate() || this.endDate());
  }

  emptyStateMessage(): string {
    if (this.hasActiveFilters()) {
      return 'Nenhum pagamento corresponde aos filtros atuais. Ajuste a busca, status ou período para ampliar o resultado.';
    }
    return 'Não há registros de transações no período selecionado. Quando houver vendas, elas aparecerão aqui.';
  }

  private loadCurrentQuery(): void {
    const query: ListPaymentsQueryDto = {
      page: this.page(),
      limit: this.limit(),
      status: this.status() === 'all' ? undefined : this.status() as PaymentStatus,
      externalId: this.search().trim() || undefined,
      startDate: this.startDate() || undefined,
      endDate: this.endDate() || undefined,
    };
    this.paymentService.loadPayments(query);
  }

  private updateQueryParams(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.search().trim() || null,
        status: this.status() === 'all' ? null : this.status(),
        startDate: this.startDate() || null,
        endDate: this.endDate() || null,
        page: page > 1 ? page : null,
        limit: this.limit() === 20 ? null : this.limit(),
      },
    });
  }

  private parseStatus(value: string | null): PaymentStatus | 'all' {
    return Object.values(PaymentStatus).includes(value as PaymentStatus) ? value as PaymentStatus : 'all';
  }

  private parsePositiveInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private eventValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
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

  isPaymentLinkAttempt(payment: { paymentLinkId?: string; paymentOrigin?: string; metadata?: Record<string, unknown> }): boolean {
    return Boolean(payment.paymentLinkId || payment.paymentOrigin === 'payment_link' || payment.metadata?.['origin'] === 'payment_link');
  }

  formatAttempt(payment: { attemptNumber?: number; attemptCount?: number }): string {
    const attemptNumber = payment.attemptNumber ?? 1;
    const attemptCount = payment.attemptCount ?? 1;
    return `Tentativa #${attemptNumber} de ${attemptCount}`;
  }

  shortId(value?: string | null): string {
    if (!value) return '-';
    return value.length <= 12 ? value : `${value.slice(0, 8)}...`;
  }
}
