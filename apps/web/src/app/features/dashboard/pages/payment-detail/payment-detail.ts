import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRightLeft,
  lucideBadgeDollarSign,
  lucideCheckCircle2,
  lucideClock,
  lucideCode2,
  lucideCreditCard,
  lucideFileText,
  lucideReceipt,
  lucideSend,
  lucideUser,
  lucideWebhook,
  lucideXCircle,
} from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import {
  PaymentService,
  PaymentStatus,
  PaymentTimelineEvent,
} from '../../../../core/services/payment.service';

@Component({
  selector: 'app-payment-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    CurrencyPipe,
    HlmButtonImports,
    HlmBadgeImports,
    HlmIconImports,
    HlmSpinnerImports,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRightLeft,
      lucideBadgeDollarSign,
      lucideCheckCircle2,
      lucideClock,
      lucideCode2,
      lucideCreditCard,
      lucideFileText,
      lucideReceipt,
      lucideSend,
      lucideUser,
      lucideWebhook,
      lucideXCircle,
    }),
  ],
  template: `
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <a
            routerLink="/dashboard/payments"
            class="mb-3 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ng-icon hlm name="lucideArrowLeft" size="sm"></ng-icon>
            Voltar para pagamentos
          </a>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Detalhes do pagamento</h1>
            @if (paymentService.currentTimeline(); as data) {
              <span class="rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-xs font-semibold text-zinc-500 shadow-sm">
                {{ shortId(data.payment.id) }}
              </span>
            }
          </div>
          @if (paymentService.currentTimeline(); as data) {
            <p class="mt-1 text-sm text-zinc-500">{{ data.payment.description || 'Pagamento Online' }}</p>
          }
        </div>

        @if (paymentService.currentTimeline(); as data) {
          <div class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap" [class]="getPaymentBadgeClasses(data.payment.status)">
            <ng-icon hlm [name]="getPaymentStatusIcon(data.payment.status)" size="xs"></ng-icon>
            {{ formatPaymentStatus(data.payment.status) }}
          </div>
        }
      </div>

      @if (paymentService.isTimelineLoading()) {
        <div class="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-zinc-200/80 bg-white py-24 shadow-sm">
          <hlm-spinner class="h-6 w-6 animate-spin text-indigo-600" />
          <p class="mt-4 text-sm font-medium text-zinc-500">Carregando pagamento...</p>
        </div>
      }

      @if (!paymentService.isTimelineLoading() && paymentService.timelineError()) {
        <div class="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-red-200/60 bg-red-50 px-6 py-24 text-center shadow-sm">
          <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
            <ng-icon hlm name="lucideXCircle" class="text-red-500" size="lg"></ng-icon>
          </div>
          <h3 class="text-base font-semibold text-red-700">Não foi possível carregar o pagamento</h3>
          <p class="mt-2 max-w-md text-sm text-red-700/90">{{ paymentService.timelineError() }}</p>
          <a routerLink="/dashboard/payments" hlmBtn class="mt-6 bg-white text-red-700 shadow-sm hover:bg-red-100">
            Voltar para a lista
          </a>
        </div>
      }

      @if (!paymentService.isTimelineLoading() && paymentService.currentTimeline(); as data) {
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Valor bruto</p>
              <ng-icon hlm name="lucideCreditCard" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="mt-3 text-lg font-semibold text-zinc-900">{{ data.payment.amount / 100 | currency:'BRL':'symbol':'1.2-2' }}</p>
          </div>

          <div class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Taxa</p>
              <ng-icon hlm name="lucideBadgeDollarSign" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="mt-3 text-lg font-semibold text-red-600">-{{ data.payment.fee / 100 | currency:'BRL':'symbol':'1.2-2' }}</p>
          </div>

          <div class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Valor líquido</p>
              <ng-icon hlm name="lucideArrowRightLeft" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="mt-3 text-lg font-semibold text-emerald-600">{{ data.payment.netAmount / 100 | currency:'BRL':'symbol':'1.2-2' }}</p>
          </div>

          <div class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Estornado</p>
              <ng-icon hlm name="lucideReceipt" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="mt-3 text-lg font-semibold text-zinc-900">{{ (data.payment.totalRefunded || 0) / 100 | currency:'BRL':'symbol':'1.2-2' }}</p>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <div class="flex items-center justify-between gap-4 border-b border-zinc-200/80 pb-5">
              <div>
                <h2 class="text-base font-semibold text-zinc-900">Timeline</h2>
                <p class="mt-1 text-xs text-zinc-500">{{ data.timeline.length }} eventos</p>
              </div>
              <ng-icon hlm name="lucideClock" class="text-zinc-400" size="sm"></ng-icon>
            </div>

            @if (data.timeline.length === 0) {
              <div class="py-16 text-center text-sm text-zinc-500">Nenhum evento registrado.</div>
            } @else {
              <ol class="mt-6 space-y-5">
                @for (event of data.timeline; track event.id) {
                  <li class="relative grid grid-cols-[2rem_1fr] gap-4">
                    <div class="flex flex-col items-center">
                      <div class="flex h-8 w-8 items-center justify-center rounded-full border bg-white" [class]="getTimelineDotClasses(event.status)">
                        <ng-icon hlm [name]="getTimelineIcon(event.type)" size="xs"></ng-icon>
                      </div>
                      @if (!$last) {
                        <div class="mt-2 h-full min-h-5 w-px bg-zinc-200"></div>
                      }
                    </div>

                    <div class="min-w-0 rounded-lg border border-zinc-200/80 bg-zinc-50/40 px-4 py-3">
                      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-2">
                            <p class="text-sm font-semibold text-zinc-900">{{ event.title }}</p>
                            <span class="rounded border px-1.5 py-0.5 text-[11px] font-semibold" [class]="getTimelineBadgeClasses(event.status)">
                              {{ formatTimelineStatus(event.status) }}
                            </span>
                          </div>
                          @if (event.description) {
                            <p class="mt-1 text-sm text-zinc-600">{{ event.description }}</p>
                          }
                        </div>
                        <time class="whitespace-nowrap text-xs font-medium text-zinc-500">{{ event.occurredAt | date:'dd/MM/yyyy HH:mm:ss' }}</time>
                      </div>

                      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        @if (event.entityId) {
                          <span class="rounded border border-zinc-200 bg-white px-2 py-1 font-mono">{{ shortId(event.entityId) }}</span>
                        }
                        @if (timelineAmount(event); as amount) {
                          <span class="rounded border border-zinc-200 bg-white px-2 py-1 font-semibold text-zinc-700">{{ amount / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                        }
                        @if (isWebhookEvent(event)) {
                          <a routerLink="/dashboard/webhooks" class="rounded border border-zinc-200 bg-white px-2 py-1 font-medium text-indigo-600 hover:text-indigo-700">
                            Webhooks
                          </a>
                        }
                      </div>
                    </div>
                  </li>
                }
              </ol>
            }
          </section>

          <aside class="flex flex-col gap-6">
            <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-50 text-zinc-600">
                  <ng-icon hlm name="lucideUser" size="sm"></ng-icon>
                </div>
                <p class="text-sm font-semibold text-zinc-900">Pagador</p>
              </div>
              <dl class="mt-5 space-y-3 text-sm">
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">Nome</dt>
                  <dd class="text-right font-medium text-zinc-900">{{ data.payment.payerName || 'Cliente não identificado' }}</dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">E-mail</dt>
                  <dd class="text-right font-medium text-zinc-900 break-all">{{ data.payment.payerEmail || 'Não informado' }}</dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">Documento</dt>
                  <dd class="text-right font-medium text-zinc-900">{{ data.payment.payerDocument || 'Não informado' }}</dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">External ID</dt>
                  <dd class="text-right font-mono text-xs font-medium text-zinc-900">{{ data.payment.externalId || '-' }}</dd>
                </div>
              </dl>
            </section>

            <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <p class="text-sm font-semibold text-zinc-900">Checkout</p>
              @if (data.checkoutSession) {
                <dl class="mt-5 space-y-3 text-sm">
                  <div class="flex items-start justify-between gap-4">
                    <dt class="text-zinc-500">Status</dt>
                    <dd class="text-right font-semibold text-zinc-900">{{ data.checkoutSession.status }}</dd>
                  </div>
                  <div class="flex items-start justify-between gap-4">
                    <dt class="text-zinc-500">Token</dt>
                    <dd class="text-right font-mono text-xs text-zinc-900">{{ shortId(data.checkoutSession.checkoutToken) }}</dd>
                  </div>
                  <div class="flex items-start justify-between gap-4">
                    <dt class="text-zinc-500">Expira em</dt>
                    <dd class="text-right font-medium text-zinc-900">{{ data.checkoutSession.expiresAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                  </div>
                </dl>
              } @else {
                <p class="mt-4 text-sm text-zinc-500">Não vinculado.</p>
              }
            </section>

            <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <p class="text-sm font-semibold text-zinc-900">Comprovante</p>
              @if (data.receipt) {
                <a [routerLink]="['/dashboard/receipts', data.receipt.id]" class="mt-4 flex items-center justify-between gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-sm hover:bg-white">
                  <span class="font-mono text-xs text-zinc-700">{{ data.receipt.receiptNumber }}</span>
                  <ng-icon hlm name="lucideFileText" class="text-zinc-400" size="xs"></ng-icon>
                </a>
              } @else {
                <p class="mt-4 text-sm text-zinc-500">Ainda não emitido.</p>
              }
            </section>

            <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <p class="text-sm font-semibold text-zinc-900">Metadados</p>
              @if (hasEntries(data.payment.metadata)) {
                <dl class="mt-5 space-y-3 text-sm">
                  @for (entry of entries(data.payment.metadata); track entry.key) {
                    <div class="flex items-start justify-between gap-4">
                      <dt class="text-zinc-500">{{ entry.key }}</dt>
                      <dd class="max-w-[13rem] truncate text-right font-medium text-zinc-900">{{ stringify(entry.value) }}</dd>
                    </div>
                  }
                </dl>
              } @else {
                <p class="mt-4 text-sm text-zinc-500">Sem metadados.</p>
              }
            </section>

            <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <p class="text-sm font-semibold text-zinc-900">Transações</p>
              @if (data.transactions.length > 0) {
                <div class="mt-4 space-y-3">
                  @for (transaction of data.transactions; track transaction.id) {
                    <div class="rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2">
                      <div class="flex items-center justify-between gap-3">
                        <span class="text-xs font-semibold text-zinc-700">{{ formatTransactionType(transaction.type) }}</span>
                        <span class="text-sm font-semibold text-zinc-900">{{ transaction.netAmount / 100 | currency:'BRL':'symbol':'1.2-2' }}</span>
                      </div>
                      <p class="mt-1 font-mono text-[11px] text-zinc-500">{{ shortId(transaction.id) }}</p>
                    </div>
                  }
                </div>
              } @else {
                <p class="mt-4 text-sm text-zinc-500">Sem lançamentos.</p>
              }
            </section>

            <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-semibold text-zinc-900">Webhooks</p>
                <a routerLink="/dashboard/webhooks" class="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Abrir</a>
              </div>
              @if (data.webhookLogs.length > 0) {
                <div class="mt-4 space-y-3">
                  @for (log of data.webhookLogs; track log.id) {
                    <div class="rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2">
                      <div class="flex items-center justify-between gap-3">
                        <span class="text-xs font-semibold text-zinc-700">{{ log.eventType }}</span>
                        <span class="text-xs font-semibold" [class]="getWebhookTextClasses(log)">{{ log.responseStatus || 'pendente' }}</span>
                      </div>
                      <dl class="mt-2 grid gap-1 text-[11px] text-zinc-500">
                        <div class="flex justify-between gap-3">
                          <dt>deliveryId</dt>
                          <dd class="font-mono">{{ shortId(log.deliveryId) }}</dd>
                        </div>
                        <div class="flex justify-between gap-3">
                          <dt>requestId</dt>
                          <dd class="font-mono">{{ log.requestId || '-' }}</dd>
                        </div>
                      </dl>
                    </div>
                  }
                </div>
              } @else {
                <p class="mt-4 text-sm text-zinc-500">Sem entregas.</p>
              }
            </section>
          </aside>
        </div>
      }
    </div>
  `,
})
export class PaymentDetail implements OnInit, OnDestroy {
  readonly paymentService = inject(PaymentService);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const paymentId = this.route.snapshot.paramMap.get('id');

    if (!paymentId) {
      this.paymentService.clearTimelineState();
      return;
    }

    this.paymentService.loadPaymentTimeline(paymentId);
  }

  ngOnDestroy(): void {
    this.paymentService.clearTimelineState();
  }

  shortId(value?: string | null): string {
    if (!value) return '-';
    return value.length <= 12 ? value : `${value.slice(0, 8)}...`;
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

  getTimelineIcon(type: PaymentTimelineEvent['type']): string {
    if (type.startsWith('webhook.')) return 'lucideWebhook';
    if (type === 'receipt.issued') return 'lucideReceipt';
    if (type === 'transaction.recorded' || type === 'payment.refunded') return 'lucideBadgeDollarSign';
    if (type === 'checkout.completed') return 'lucideCreditCard';
    if (type === 'payment.failed' || type === 'payment.expired') return 'lucideXCircle';
    return 'lucideCheckCircle2';
  }

  getTimelineDotClasses(status: PaymentTimelineEvent['status']): string {
    switch (status) {
      case 'completed':
        return 'border-emerald-200 bg-emerald-50 text-emerald-600';
      case 'pending':
        return 'border-amber-200 bg-amber-50 text-amber-600';
      case 'failed':
        return 'border-red-200 bg-red-50 text-red-600';
      default:
        return 'border-zinc-200 bg-zinc-50 text-zinc-500';
    }
  }

  getTimelineBadgeClasses(status: PaymentTimelineEvent['status']): string {
    switch (status) {
      case 'completed':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'pending':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'failed':
        return 'border-red-200 bg-red-50 text-red-700';
      default:
        return 'border-zinc-200 bg-white text-zinc-600';
    }
  }

  formatTimelineStatus(status: PaymentTimelineEvent['status']): string {
    const map: Record<string, string> = {
      completed: 'concluído',
      pending: 'pendente',
      failed: 'falhou',
      neutral: 'registro',
    };
    return map[status] || status;
  }

  timelineAmount(event: PaymentTimelineEvent): number | null {
    const value = event.metadata?.['amount'] ?? event.metadata?.['netAmount'];
    return typeof value === 'number' ? value : null;
  }

  isWebhookEvent(event: PaymentTimelineEvent): boolean {
    return event.type.startsWith('webhook.');
  }

  hasEntries(value?: Record<string, unknown> | null): boolean {
    return Object.keys(value ?? {}).length > 0;
  }

  entries(value?: Record<string, unknown> | null): Array<{ key: string; value: unknown }> {
    return Object.entries(value ?? {}).map(([key, entryValue]) => ({
      key,
      value: entryValue,
    }));
  }

  stringify(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  formatTransactionType(type: string): string {
    const map: Record<string, string> = {
      PAYMENT_RECEIVED: 'Pagamento recebido',
      PAYMENT_RELEASED: 'Saldo liberado',
      REFUND_DEDUCTED: 'Estorno debitado',
      FEE_CHARGED: 'Taxa',
      ADJUSTMENT: 'Ajuste',
    };
    return map[type] || type;
  }

  getWebhookTextClasses(log: { deliveredAt?: Date | string; responseStatus?: number }): string {
    if (log.deliveredAt) return 'text-emerald-700';
    if (log.responseStatus) return 'text-red-700';
    return 'text-amber-700';
  }
}
