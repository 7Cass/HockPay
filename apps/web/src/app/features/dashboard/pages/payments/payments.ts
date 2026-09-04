import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideReceipt, lucideRefreshCcw, lucideSearch } from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import {
  ListPaymentsQueryDto,
  PaymentService,
  PaymentStatus,
} from '../../../../core/services/payment.service';
import { PageHeader, PageState, Pagination, StatusChip } from '../../../../shared/ui';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    NgIcon,
    RouterLink,
    PageHeader,
    PageState,
    Pagination,
    StatusChip,
  ],
  providers: [provideIcons({ lucideReceipt, lucideRefreshCcw, lucideSearch })],
  templateUrl: './payments.html',
  styleUrl: './payments.css',
})
export class Payments implements OnInit, OnDestroy {
  readonly paymentService = inject(PaymentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private routeSub?: Subscription;

  readonly search = signal('');
  readonly status = signal<PaymentStatus | 'all'>('all');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly page = signal(1);
  readonly limit = signal(20);

  /** Linhas fantasmas do carregamento: a página não pula quando os dados chegam. */
  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];

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
      this.search.set(params.get('q') ?? '');
      this.status.set(this.parseStatus(params.get('status')));
      this.startDate.set(params.get('startDate') ?? '');
      this.endDate.set(params.get('endDate') ?? '');
      this.page.set(this.parsePositiveInt(params.get('page'), 1));
      this.limit.set(this.parsePositiveInt(params.get('limit'), 20));
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

  goToPage(page: number): void {
    this.updateQueryParams(page);
  }

  openPayment(paymentId: string): void {
    void this.router.navigate(['/dashboard/payments', paymentId]);
  }

  hasActiveFilters(): boolean {
    return Boolean(
      this.search().trim() || this.status() !== 'all' || this.startDate() || this.endDate(),
    );
  }

  emptyStateMessage(): string {
    if (this.hasActiveFilters()) {
      return 'Nenhum pagamento corresponde aos filtros atuais. Amplie o período ou solte o status.';
    }
    return 'Assim que a primeira cobrança for criada, ela aparece aqui com taxa e líquido.';
  }

  isPaymentLinkAttempt(payment: {
    paymentLinkId?: string;
    paymentOrigin?: string;
    metadata?: Record<string, unknown>;
  }): boolean {
    return Boolean(
      payment.paymentLinkId ||
        payment.paymentOrigin === 'payment_link' ||
        payment.metadata?.['origin'] === 'payment_link',
    );
  }

  formatAttempt(payment: { attemptNumber?: number; attemptCount?: number }): string {
    return `tentativa ${payment.attemptNumber ?? 1}/${payment.attemptCount ?? 1}`;
  }

  shortId(value?: string | null): string {
    if (!value) return '—';
    return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
  }

  private loadCurrentQuery(): void {
    const query: ListPaymentsQueryDto = {
      page: this.page(),
      limit: this.limit(),
      status: this.status() === 'all' ? undefined : (this.status() as PaymentStatus),
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
    return Object.values(PaymentStatus).includes(value as PaymentStatus)
      ? (value as PaymentStatus)
      : 'all';
  }

  private parsePositiveInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private eventValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
  }
}
