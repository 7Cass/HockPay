import { CurrencyPipe, DatePipe, JsonPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCheckCircle2,
  lucideClock,
  lucideCreditCard,
  lucideFileText,
  lucideMail,
  lucideMapPin,
  lucidePhone,
  lucideReceipt,
  lucideRefreshCcw,
  lucideUserRound,
  lucideXCircle,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { CustomerObject, CustomerService } from '../../../../core/services/customer.service';
import { PaymentObject, PaymentService, PaymentStatus } from '../../../../core/services/payment.service';
import { ReceiptService, ReceiptStatus } from '../../../../core/services/receipt.service';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    JsonPipe,
    RouterLink,
    HlmButtonImports,
    HlmIconImports,
    HlmSpinnerImports,
    HlmTableImports,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCheckCircle2,
      lucideClock,
      lucideCreditCard,
      lucideFileText,
      lucideMail,
      lucideMapPin,
      lucidePhone,
      lucideReceipt,
      lucideRefreshCcw,
      lucideUserRound,
      lucideXCircle,
    }),
  ],
  template: `
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <div>
        <button
          hlmBtn
          variant="ghost"
          size="sm"
          class="-ml-2 mb-4 gap-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          (click)="goBack()"
        >
          <ng-icon hlm name="lucideArrowLeft" size="xs"></ng-icon>
          Voltar
        </button>

        @if (customerService.isDetailLoading()) {
          <div class="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-zinc-200/80 bg-white shadow-sm">
            <hlm-spinner class="h-6 w-6 animate-spin text-indigo-600" />
            <p class="mt-4 text-sm font-medium text-zinc-500">Carregando cliente...</p>
          </div>
        }

        @if (customerService.detailError()) {
          <div class="flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50 p-4 text-red-700 shadow-sm">
            <ng-icon hlm name="lucideXCircle" class="mt-0.5 text-red-500"></ng-icon>
            <div class="flex-1">
              <h3 class="text-sm font-semibold">Erro ao carregar cliente</h3>
              <p class="mt-1 text-sm opacity-90">{{ customerService.detailError() }}</p>
            </div>
          </div>
        }

        @if (!customerService.isDetailLoading() && customerService.currentCustomer(); as customer) {
          <div class="flex flex-col gap-6">
            <div class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div class="flex items-start gap-4">
                  <div class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm">
                    <ng-icon hlm name="lucideUserRound" size="lg" strokeWidth="1.7"></ng-icon>
                  </div>
                  <div class="min-w-0">
                    <h1 class="truncate text-2xl font-bold tracking-tight text-zinc-900">{{ displayName(customer) }}</h1>
                    <p class="mt-1 text-sm text-zinc-500">{{ customer.formattedDocument }} · {{ customer.documentType }}</p>
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <span class="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-xs font-medium text-zinc-600">
                        {{ customer.id }}
                      </span>
                      @if (customer.externalId) {
                        <span class="rounded-md border border-zinc-200 bg-white px-2.5 py-1 font-mono text-xs font-medium text-zinc-600">
                          {{ customer.externalId }}
                        </span>
                      }
                    </div>
                  </div>
                </div>

                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  class="gap-2 self-start border-zinc-200/80 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
                  (click)="reload()"
                >
                  <ng-icon hlm name="lucideRefreshCcw" size="xs"></ng-icon>
                  Atualizar
                </button>
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <section class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total pago</p>
                  <ng-icon hlm name="lucideCreditCard" class="text-zinc-400" size="sm"></ng-icon>
                </div>
                <p class="mt-3 text-lg font-semibold text-emerald-600">{{ totalPaidAmount() / 100 | currency:'BRL':'symbol':'1.2-2' }}</p>
                <p class="mt-1 text-xs text-zinc-500">{{ summaryScopeLabel(paymentService.payments().length, paymentService.total()) }}</p>
              </section>

              <section class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pagamentos</p>
                  <ng-icon hlm name="lucideCheckCircle2" class="text-zinc-400" size="sm"></ng-icon>
                </div>
                <p class="mt-3 text-lg font-semibold text-zinc-900">{{ paymentService.total() }}</p>
                <p class="mt-1 text-xs text-zinc-500">registros vinculados</p>
              </section>

              <section class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Último pagamento</p>
                  <ng-icon hlm name="lucideClock" class="text-zinc-400" size="sm"></ng-icon>
                </div>
                @if (lastPayment(); as payment) {
                  <p class="mt-3 text-sm font-semibold text-zinc-900">{{ payment.createdAt | date:'dd/MM/yyyy HH:mm' }}</p>
                  <p class="mt-1 text-xs text-zinc-500">{{ formatPaymentStatus(payment.status) }} · {{ payment.amount / 100 | currency:'BRL':'symbol':'1.2-2' }}</p>
                } @else {
                  <p class="mt-3 text-sm font-semibold text-zinc-900">Sem pagamentos</p>
                  <p class="mt-1 text-xs text-zinc-500">nenhum registro carregado</p>
                }
              </section>

              <section class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Comprovantes</p>
                  <ng-icon hlm name="lucideReceipt" class="text-zinc-400" size="sm"></ng-icon>
                </div>
                <p class="mt-3 text-lg font-semibold text-zinc-900">{{ totalReceiptsAmount() / 100 | currency:'BRL':'symbol':'1.2-2' }}</p>
                <p class="mt-1 text-xs text-zinc-500">{{ summaryScopeLabel(receiptService.receipts().length, receiptService.total()) }}</p>
              </section>
            </div>

            <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div class="flex flex-col gap-6">
                <section class="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm">
                  <div class="flex items-center justify-between border-b border-zinc-200/80 bg-zinc-50/50 px-6 py-4">
                    <div>
                      <h2 class="text-base font-semibold text-zinc-900">Pagamentos</h2>
                      <p class="mt-0.5 text-sm text-zinc-500">{{ paymentService.total() }} registros vinculados</p>
                    </div>
                    <a
                      hlmBtn
                      variant="ghost"
                      size="sm"
                      class="gap-2 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                      [routerLink]="['/dashboard/payments']"
                    >
                      Ver todos
                      <ng-icon hlm name="lucideArrowRight" size="xs"></ng-icon>
                    </a>
                  </div>

                  @if (paymentService.isLoading()) {
                    <div class="flex flex-col items-center justify-center py-16">
                      <hlm-spinner class="h-6 w-6 animate-spin text-indigo-600" />
                      <p class="mt-4 text-sm font-medium text-zinc-500">Buscando pagamentos...</p>
                    </div>
                  } @else if (paymentService.error()) {
                    <div class="flex items-start gap-3 p-6 text-red-700">
                      <ng-icon hlm name="lucideXCircle" class="mt-0.5 text-red-500"></ng-icon>
                      <p class="text-sm">{{ paymentService.error() }}</p>
                    </div>
                  } @else if (paymentService.payments().length === 0) {
                    <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <ng-icon hlm name="lucideCreditCard" size="lg" class="text-zinc-300"></ng-icon>
                      <p class="mt-3 text-sm text-zinc-500">Nenhum pagamento vinculado a este cliente.</p>
                    </div>
                  } @else {
                    <div class="overflow-x-auto">
                      <table hlmTable class="w-full">
                        <thead hlmTHead class="border-b border-zinc-200/80 bg-zinc-50/50">
                          <tr hlmTr class="border-none hover:bg-transparent">
                            <th hlmTh class="py-3.5 pl-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">Pagamento</th>
                            <th hlmTh class="py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Valor</th>
                            <th hlmTh class="py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                            <th hlmTh class="py-3.5 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Criado em</th>
                          </tr>
                        </thead>
                        <tbody hlmTBody class="divide-y divide-zinc-100">
                          @for (payment of paymentService.payments(); track payment.id) {
                            <tr hlmTr [routerLink]="['/dashboard/payments', payment.id]" class="cursor-pointer border-none transition-colors hover:bg-zinc-50/80">
                              <td hlmTd class="py-3.5 pl-6">
                                <div class="flex flex-col">
                                  <span class="text-sm font-medium text-zinc-900">{{ payment.description || 'Pagamento Online' }}</span>
                                  <span class="mt-0.5 font-mono text-xs text-zinc-400">{{ payment.id.slice(0, 8) }}...</span>
                                </div>
                              </td>
                              <td hlmTd class="py-3.5 text-right">
                                <span class="text-sm font-semibold text-emerald-600">{{ payment.amount / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                              </td>
                              <td hlmTd class="px-4 py-3.5 text-center">
                                <span class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap" [class]="getPaymentBadgeClasses(payment.status)">
                                  <ng-icon hlm [name]="getPaymentStatusIcon(payment.status)" size="xs"></ng-icon>
                                  {{ formatPaymentStatus(payment.status) }}
                                </span>
                              </td>
                              <td hlmTd class="py-3.5 pr-6 text-right">
                                <div class="flex flex-col">
                                  <span class="text-sm font-medium text-zinc-900">{{ payment.createdAt | date:'dd/MM/yyyy' }}</span>
                                  <span class="mt-0.5 text-xs text-zinc-400">{{ payment.createdAt | date:'HH:mm' }}</span>
                                </div>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                </section>

                <section class="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm">
                  <div class="flex items-center justify-between border-b border-zinc-200/80 bg-zinc-50/50 px-6 py-4">
                    <div>
                      <h2 class="text-base font-semibold text-zinc-900">Comprovantes</h2>
                      <p class="mt-0.5 text-sm text-zinc-500">{{ receiptService.total() }} registros vinculados</p>
                    </div>
                    <a
                      hlmBtn
                      variant="ghost"
                      size="sm"
                      class="gap-2 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                      [routerLink]="['/dashboard/receipts']"
                    >
                      Ver todos
                      <ng-icon hlm name="lucideArrowRight" size="xs"></ng-icon>
                    </a>
                  </div>

                  @if (receiptService.isLoading()) {
                    <div class="flex flex-col items-center justify-center py-16">
                      <hlm-spinner class="h-6 w-6 animate-spin text-indigo-600" />
                      <p class="mt-4 text-sm font-medium text-zinc-500">Buscando comprovantes...</p>
                    </div>
                  } @else if (receiptService.error()) {
                    <div class="flex items-start gap-3 p-6 text-red-700">
                      <ng-icon hlm name="lucideXCircle" class="mt-0.5 text-red-500"></ng-icon>
                      <p class="text-sm">{{ receiptService.error() }}</p>
                    </div>
                  } @else if (receiptService.receipts().length === 0) {
                    <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <ng-icon hlm name="lucideReceipt" size="lg" class="text-zinc-300"></ng-icon>
                      <p class="mt-3 text-sm text-zinc-500">Nenhum comprovante vinculado a este cliente.</p>
                    </div>
                  } @else {
                    <div class="overflow-x-auto">
                      <table hlmTable class="w-full">
                        <thead hlmTHead class="border-b border-zinc-200/80 bg-zinc-50/50">
                          <tr hlmTr class="border-none hover:bg-transparent">
                            <th hlmTh class="py-3.5 pl-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">Número</th>
                            <th hlmTh class="py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Valor</th>
                            <th hlmTh class="py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                            <th hlmTh class="py-3.5 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Emitido em</th>
                          </tr>
                        </thead>
                        <tbody hlmTBody class="divide-y divide-zinc-100">
                          @for (receipt of receiptService.receipts(); track receipt.id) {
                            <tr hlmTr [routerLink]="['/dashboard/receipts', receipt.id]" class="cursor-pointer border-none transition-colors hover:bg-zinc-50/80">
                              <td hlmTd class="py-3.5 pl-6">
                                <div class="flex flex-col">
                                  <span class="font-mono text-sm font-semibold text-zinc-900">{{ receipt.receiptNumber }}</span>
                                  <span class="mt-0.5 font-mono text-xs text-zinc-400">{{ receipt.paymentId.slice(0, 8) }}...</span>
                                </div>
                              </td>
                              <td hlmTd class="py-3.5 text-right">
                                <span class="text-sm font-semibold text-emerald-600">{{ receipt.amount / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                              </td>
                              <td hlmTd class="px-4 py-3.5 text-center">
                                <span class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap" [class]="getReceiptBadgeClasses(receipt.status)">
                                  <ng-icon hlm [name]="getReceiptStatusIcon(receipt.status)" size="xs"></ng-icon>
                                  {{ formatReceiptStatus(receipt.status) }}
                                </span>
                              </td>
                              <td hlmTd class="py-3.5 pr-6 text-right">
                                <div class="flex flex-col">
                                  <span class="text-sm font-medium text-zinc-900">{{ receipt.issuedAt | date:'dd/MM/yyyy' }}</span>
                                  <span class="mt-0.5 text-xs text-zinc-400">{{ receipt.issuedAt | date:'HH:mm' }}</span>
                                </div>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                </section>
              </div>

              <aside class="flex flex-col gap-6">
                <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
                  <h2 class="text-base font-semibold text-zinc-900">Contato</h2>
                  <div class="mt-5 flex flex-col gap-4">
                    <div class="flex items-start gap-3">
                      <ng-icon hlm name="lucideMail" class="mt-0.5 text-zinc-400" size="sm"></ng-icon>
                      <div>
                        <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Email</p>
                        <p class="mt-1 text-sm font-medium text-zinc-900">{{ customer.email || 'Não informado' }}</p>
                      </div>
                    </div>
                    <div class="flex items-start gap-3">
                      <ng-icon hlm name="lucidePhone" class="mt-0.5 text-zinc-400" size="sm"></ng-icon>
                      <div>
                        <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Telefone</p>
                        <p class="mt-1 text-sm font-medium text-zinc-900">{{ customer.phone || 'Não informado' }}</p>
                      </div>
                    </div>
                    <div class="flex items-start gap-3">
                      <ng-icon hlm name="lucideMapPin" class="mt-0.5 text-zinc-400" size="sm"></ng-icon>
                      <div>
                        <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Endereço</p>
                        <p class="mt-1 text-sm font-medium text-zinc-900">{{ addressLine(customer) }}</p>
                        @if (customer.city || customer.state || customer.zipCode) {
                          <p class="mt-0.5 text-xs text-zinc-500">{{ locationLine(customer) }}</p>
                        }
                      </div>
                    </div>
                  </div>
                </section>

                <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
                  <h2 class="text-base font-semibold text-zinc-900">Cadastro</h2>
                  <dl class="mt-5 space-y-4">
                    <div class="flex items-start justify-between gap-4">
                      <dt class="text-sm text-zinc-500">Criado em</dt>
                      <dd class="text-right text-sm font-medium text-zinc-900">{{ customer.createdAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-4">
                      <dt class="text-sm text-zinc-500">Atualizado em</dt>
                      <dd class="text-right text-sm font-medium text-zinc-900">{{ customer.updatedAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-4">
                      <dt class="text-sm text-zinc-500">País</dt>
                      <dd class="text-right text-sm font-medium text-zinc-900">{{ customer.country || 'BR' }}</dd>
                    </div>
                  </dl>
                </section>

                <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
                  <div class="flex items-center gap-2">
                    <ng-icon hlm name="lucideFileText" class="text-zinc-400" size="sm"></ng-icon>
                    <h2 class="text-base font-semibold text-zinc-900">Metadata</h2>
                  </div>

                  @if (metadataEntries(customer).length === 0) {
                    <p class="mt-4 text-sm text-zinc-500">Sem metadata registrada.</p>
                  } @else {
                    <dl class="mt-5 space-y-4">
                      @for (entry of metadataEntries(customer); track entry[0]) {
                        <div>
                          <dt class="text-xs font-semibold uppercase tracking-wider text-zinc-500">{{ entry[0] }}</dt>
                          <dd class="mt-1 break-words rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700">{{ entry[1] | json }}</dd>
                        </div>
                      }
                    </dl>
                  }
                </section>
              </aside>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class CustomerDetail implements OnInit, OnDestroy {
  readonly customerService = inject(CustomerService);
  readonly paymentService = inject(PaymentService);
  readonly receiptService = inject(ReceiptService);
  readonly totalPaidAmount = computed(() =>
    this.paymentService.payments()
      .filter((payment) => this.isPaidPayment(payment.status))
      .reduce((sum, payment) => sum + payment.amount, 0),
  );
  readonly totalReceiptsAmount = computed(() =>
    this.receiptService.receipts().reduce((sum, receipt) => sum + receipt.amount, 0),
  );
  readonly lastPayment = computed<PaymentObject | null>(() => this.paymentService.payments()[0] ?? null);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private customerId = '';

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.customerId) {
      this.goBack();
      return;
    }

    this.reload();
  }

  ngOnDestroy(): void {
    this.customerService.clearDetailState();
  }

  reload(): void {
    this.customerService.loadCustomer(this.customerId);
    this.paymentService.loadPayments({
      customerId: this.customerId,
      page: 1,
      limit: 10,
    });
    this.receiptService.loadReceipts({
      customerId: this.customerId,
      page: 1,
      limit: 10,
    });
  }

  goBack(): void {
    void this.router.navigate(['/dashboard/customers']);
  }

  displayName(customer: CustomerObject): string {
    return customer.name || customer.email || customer.externalId || customer.formattedDocument;
  }

  addressLine(customer: CustomerObject): string {
    const parts = [customer.street, customer.number, customer.complement].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Não informado';
  }

  locationLine(customer: CustomerObject): string {
    return [customer.city, customer.state, customer.zipCode].filter(Boolean).join(' · ');
  }

  metadataEntries(customer: CustomerObject): [string, unknown][] {
    return Object.entries(customer.metadata || {});
  }

  summaryScopeLabel(loaded: number, total: number): string {
    if (loaded === 0) return 'sem registros carregados';
    return loaded < total ? `resumo de ${loaded} carregados` : 'todos os registros carregados';
  }

  formatPaymentStatus(status: PaymentStatus): string {
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

  getPaymentStatusIcon(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.CONFIRMED:
      case PaymentStatus.RELEASED:
        return 'lucideCheckCircle2';
      case PaymentStatus.PENDING:
        return 'lucideClock';
      default:
        return 'lucideXCircle';
    }
  }

  getPaymentBadgeClasses(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.CONFIRMED:
      case PaymentStatus.RELEASED:
        return 'border-emerald-200/60 bg-emerald-50 text-emerald-700';
      case PaymentStatus.PENDING:
        return 'border-amber-200/60 bg-amber-50 text-amber-700';
      default:
        return 'border-red-200/60 bg-red-50 text-red-700';
    }
  }

  private isPaidPayment(status: PaymentStatus): boolean {
    return [
      PaymentStatus.CONFIRMED,
      PaymentStatus.RELEASED,
      PaymentStatus.REFUNDED,
    ].includes(status);
  }

  formatReceiptStatus(status: ReceiptStatus): string {
    return status === ReceiptStatus.CANCELLED ? 'Cancelado' : 'Emitido';
  }

  getReceiptStatusIcon(status: ReceiptStatus): string {
    return status === ReceiptStatus.CANCELLED ? 'lucideXCircle' : 'lucideCheckCircle2';
  }

  getReceiptBadgeClasses(status: ReceiptStatus): string {
    return status === ReceiptStatus.CANCELLED
      ? 'border-red-200/60 bg-red-50 text-red-700'
      : 'border-emerald-200/60 bg-emerald-50 text-emerald-700';
  }
}
