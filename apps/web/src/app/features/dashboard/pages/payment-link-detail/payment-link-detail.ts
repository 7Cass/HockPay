import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, Subscription, finalize } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import {
  lucideAlertTriangle,
  lucideArrowLeft,
  lucideBadgeDollarSign,
  lucideCheckCircle2,
  lucideClock,
  lucideCopy,
  lucideExternalLink,
  lucideLink,
  lucideReceipt,
  lucideRefreshCcw,
  lucideTestTubeDiagonal,
  lucideXCircle,
} from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import {
  PaymentLinkItem,
  PaymentLinkService,
  PaymentLinkStatus,
} from '../../../../core/services/payment-link.service';
import type { PaymentObject } from '../../../../core/services/payment.service';

@Component({
  selector: 'app-payment-link-detail',
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
      lucideAlertTriangle,
      lucideArrowLeft,
      lucideBadgeDollarSign,
      lucideCheckCircle2,
      lucideClock,
      lucideCopy,
      lucideExternalLink,
      lucideLink,
      lucideReceipt,
      lucideRefreshCcw,
      lucideTestTubeDiagonal,
      lucideXCircle,
    }),
  ],
  template: `
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <a
            routerLink="/dashboard/payment-links"
            class="mb-3 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ng-icon hlm name="lucideArrowLeft" size="sm"></ng-icon>
            Voltar para links
          </a>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Detalhes do payment link</h1>
            @if (link(); as paymentLink) {
              <span class="rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-xs font-semibold text-zinc-500 shadow-sm">
                {{ shortId(paymentLink.id) }}
              </span>
            }
          </div>
          @if (link(); as paymentLink) {
            <p class="mt-1 text-sm text-zinc-500">{{ title(paymentLink) }}</p>
          }
        </div>

        @if (link(); as paymentLink) {
          <span class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap" [class]="statusClass(paymentLink.status)">
            <ng-icon hlm [name]="statusIcon(paymentLink.status)" size="xs"></ng-icon>
            {{ statusLabel(paymentLink.status) }}
          </span>
        }
      </div>

      @if (isLoading()) {
        <div class="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-zinc-200/80 bg-white py-24 shadow-sm">
          <hlm-spinner class="h-6 w-6 animate-spin text-indigo-600" />
          <p class="mt-4 text-sm font-medium text-zinc-500">Carregando link...</p>
        </div>
      }

      @if (!isLoading() && error()) {
        <div class="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-red-200/60 bg-red-50 px-6 py-24 text-center shadow-sm">
          <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
            <ng-icon hlm name="lucideXCircle" class="text-red-500" size="lg"></ng-icon>
          </div>
          <h3 class="text-base font-semibold text-red-700">Não foi possível carregar o link</h3>
          <p class="mt-2 max-w-md text-sm text-red-700/90">{{ error() }}</p>
          <a routerLink="/dashboard/payment-links" hlmBtn class="mt-6 bg-white text-red-700 shadow-sm hover:bg-red-100">
            Voltar para a lista
          </a>
        </div>
      }

      @if (!isLoading() && link(); as paymentLink) {
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Valor</p>
              <ng-icon hlm name="lucideBadgeDollarSign" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="mt-3 text-lg font-semibold text-zinc-900">{{ paymentLink.amount / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</p>
          </div>

          <div class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</p>
              <ng-icon hlm [name]="statusIcon(paymentLink.status)" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="mt-3 text-lg font-semibold text-zinc-900">{{ statusLabel(paymentLink.status) }}</p>
          </div>

          <div class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Conversão local</p>
              <ng-icon hlm name="lucideCheckCircle2" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="mt-3 text-lg font-semibold text-zinc-900">{{ isPaid(paymentLink) ? 'Convertido' : 'Não convertido' }}</p>
          </div>

          <div class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Falhas</p>
              <ng-icon hlm name="lucideAlertTriangle" class="text-zinc-400" size="sm"></ng-icon>
            </div>
            <p class="mt-3 text-lg font-semibold" [class]="paymentLink.failedPaymentCount > 0 ? 'text-red-600' : 'text-zinc-900'">
              {{ paymentLink.failedPaymentCount }}
            </p>
          </div>
        </div>

        <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Estado atual</p>
              <h2 class="mt-2 text-base font-semibold text-zinc-900">{{ stateTitle(paymentLink) }}</h2>
              <p class="mt-1 max-w-3xl text-sm text-zinc-600">{{ stateDescription(paymentLink) }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button hlmBtn type="button" variant="outline" class="gap-2 border-zinc-200" (click)="copy(paymentLink)">
                <ng-icon hlm name="lucideCopy" size="xs"></ng-icon>
                {{ copied() ? 'Copiado' : 'Copiar link' }}
              </button>
              <a hlmBtn variant="outline" class="gap-2 border-zinc-200" [href]="paymentLink.checkoutUrl" target="_blank" rel="noreferrer">
                <ng-icon hlm name="lucideExternalLink" size="xs"></ng-icon>
                Abrir checkout
              </a>
            </div>
          </div>

          <dl class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
              <dt class="text-xs font-medium text-zinc-500">Criado em</dt>
              <dd class="mt-1 text-sm font-semibold text-zinc-900">{{ paymentLink.createdAt | date:'dd/MM/yyyy HH:mm' }}</dd>
            </div>
            <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
              <dt class="text-xs font-medium text-zinc-500">Expiração</dt>
              <dd class="mt-1 text-sm font-semibold text-zinc-900">{{ paymentLink.expiresAt ? (paymentLink.expiresAt | date:'dd/MM/yyyy HH:mm') : 'Sem expiração' }}</dd>
            </div>
            <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
              <dt class="text-xs font-medium text-zinc-500">Payment atual</dt>
              <dd class="mt-1 font-mono text-sm font-semibold text-zinc-900">{{ shortId(paymentLink.lastPaymentId) }}</dd>
            </div>
            <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
              <dt class="text-xs font-medium text-zinc-500">Referência</dt>
              <dd class="mt-1 break-words text-sm font-semibold text-zinc-900">{{ paymentLink.internalReference || '-' }}</dd>
            </div>
          </dl>
        </section>

        <div class="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <div class="flex items-center justify-between gap-4 border-b border-zinc-200/80 pb-5">
              <div>
                <h2 class="text-base font-semibold text-zinc-900">Tentativas</h2>
                <p class="mt-1 text-xs text-zinc-500">{{ attempts(paymentLink).length }} payment(s) para a mesma cobrança Pix</p>
              </div>
              <ng-icon hlm name="lucideReceipt" class="text-zinc-400" size="sm"></ng-icon>
            </div>

            @if (attempts(paymentLink).length === 0) {
              <div class="py-16 text-center">
                <ng-icon hlm name="lucideReceipt" size="lg" class="text-zinc-300"></ng-icon>
                <p class="mt-3 text-sm text-zinc-500">Nenhuma tentativa gerada ainda.</p>
              </div>
            } @else {
              <div class="mt-5 overflow-x-auto">
                <table class="w-full min-w-[680px] text-left">
                  <thead>
                    <tr class="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <th class="py-3 pr-4">Tentativa</th>
                      <th class="px-4 py-3">Status</th>
                      <th class="px-4 py-3">Valor</th>
                      <th class="px-4 py-3">Criada</th>
                      <th class="px-4 py-3">Motivo</th>
                      <th class="py-3 pl-4 text-right">Pagamento</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-100">
                    @for (attempt of attempts(paymentLink); track attempt.id) {
                      <tr>
                        <td class="py-4 pr-4">
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-semibold text-zinc-900">{{ formatAttempt(attempt) }}</span>
                            @if (attempt.isLatestAttempt) {
                              <span class="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">atual</span>
                            }
                          </div>
                          <p class="mt-1 font-mono text-xs text-zinc-500">{{ shortId(attempt.id) }}</p>
                        </td>
                        <td class="px-4 py-4">
                          <span class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold" [class]="paymentStatusClass(attempt.status)">
                            <ng-icon hlm [name]="paymentStatusIcon(attempt.status)" size="xs"></ng-icon>
                            {{ paymentStatusLabel(attempt.status) }}
                          </span>
                        </td>
                        <td class="px-4 py-4 text-sm font-semibold text-zinc-900">{{ attempt.amount / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td>
                        <td class="px-4 py-4 text-sm text-zinc-600">{{ attempt.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                        <td class="max-w-[12rem] truncate px-4 py-4 text-sm text-zinc-600">{{ attempt.failedReason || '-' }}</td>
                        <td class="py-4 pl-4 text-right">
                          <a hlmBtn variant="outline" size="sm" class="gap-2 border-zinc-200" [routerLink]="['/dashboard/payments', attempt.id]">
                            <ng-icon hlm name="lucideExternalLink" size="xs"></ng-icon>
                            Ver
                          </a>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <aside class="flex flex-col gap-6">
            <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <ng-icon hlm name="lucideLink" size="sm"></ng-icon>
                </div>
                <div>
                  <p class="text-sm font-semibold text-zinc-900">Cobrança Pix</p>
                  <p class="mt-0.5 text-xs text-zinc-500">Uma PixCharge reutilizada pelas tentativas</p>
                </div>
              </div>

              <dl class="mt-5 space-y-3 text-sm">
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">PixCharge</dt>
                  <dd class="text-right font-mono text-xs font-medium text-zinc-900">{{ shortId(paymentLink.pixCharge.id) }}</dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">TxID</dt>
                  <dd class="max-w-[13rem] truncate text-right font-mono text-xs font-medium text-zinc-900">{{ paymentLink.pixCharge.pixTxId }}</dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">Status</dt>
                  <dd class="text-right font-semibold text-zinc-900">{{ paymentLink.pixCharge.status }}</dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-zinc-500">Expira em</dt>
                  <dd class="text-right font-medium text-zinc-900">{{ paymentLink.pixCharge.expiresAt ? (paymentLink.pixCharge.expiresAt | date:'dd/MM/yyyy HH:mm') : 'Sem expiração' }}</dd>
                </div>
                @if (paymentLink.pixCharge.paidAt) {
                  <div class="flex items-start justify-between gap-4">
                    <dt class="text-zinc-500">Pago em</dt>
                    <dd class="text-right font-medium text-zinc-900">{{ paymentLink.pixCharge.paidAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                  </div>
                }
              </dl>
            </section>

            <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-50 text-zinc-600">
                  <ng-icon hlm name="lucideTestTubeDiagonal" size="sm"></ng-icon>
                </div>
                <div>
                  <p class="text-sm font-semibold text-zinc-900">Dev mode</p>
                  <p class="mt-0.5 text-xs text-zinc-500">Simula novas tentativas em ambiente TEST.</p>
                </div>
              </div>

              @if (actionError()) {
                <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {{ actionError() }}
                </div>
              }

              <div class="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button hlmBtn type="button" class="gap-2 bg-emerald-600 text-white hover:bg-emerald-700" [disabled]="!canSimulate(paymentLink)" (click)="simulatePay(paymentLink)">
                  <ng-icon hlm name="lucideCheckCircle2" size="xs"></ng-icon>
                  Pagar
                </button>
                <button hlmBtn type="button" variant="outline" class="gap-2 border-red-200 text-red-700 hover:bg-red-50" [disabled]="!canSimulate(paymentLink)" (click)="simulateFail(paymentLink)">
                  <ng-icon hlm name="lucideXCircle" size="xs"></ng-icon>
                  Falhar
                </button>
              </div>
              <p class="mt-3 text-xs text-zinc-500">{{ devModeHint(paymentLink) }}</p>
            </section>

            <section class="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
              <p class="text-sm font-semibold text-zinc-900">Ações do link</p>
              <div class="mt-5 grid gap-2">
                <button hlmBtn type="button" variant="outline" class="justify-start gap-2 border-zinc-200" (click)="copy(paymentLink)">
                  <ng-icon hlm name="lucideCopy" size="xs"></ng-icon>
                  Copiar URL pública
                </button>
                <a hlmBtn variant="outline" class="justify-start gap-2 border-zinc-200" [href]="paymentLink.checkoutUrl" target="_blank" rel="noreferrer">
                  <ng-icon hlm name="lucideExternalLink" size="xs"></ng-icon>
                  Abrir checkout público
                </a>
                <button hlmBtn type="button" variant="outline" class="justify-start gap-2 border-red-200 text-red-700 hover:bg-red-50" [disabled]="!canCancel(paymentLink)" (click)="cancel(paymentLink)">
                  <ng-icon hlm name="lucideXCircle" size="xs"></ng-icon>
                  Cancelar link
                </button>
              </div>
            </section>
          </aside>
        </div>
      }
    </div>
  `,
})
export class PaymentLinkDetail implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PaymentLinkService);
  private routeSub?: Subscription;

  readonly link = signal<PaymentLinkItem | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionInProgress = signal(false);
  readonly copied = signal(false);
  readonly currentId = computed(() => this.link()?.id ?? null);

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.link.set(null);
        return;
      }
      this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  load(id = this.currentId()): void {
    if (!id) return;
    this.isLoading.set(true);
    this.error.set(null);
    this.service.get(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => this.link.set(response.paymentLink),
        error: (err) => this.error.set(err.message || 'Erro ao carregar payment link'),
      });
  }

  simulatePay(paymentLink: PaymentLinkItem): void {
    if (!this.canSimulate(paymentLink)) return;
    this.runAction(() => this.service.simulatePay(paymentLink.id));
  }

  simulateFail(paymentLink: PaymentLinkItem): void {
    if (!this.canSimulate(paymentLink)) return;
    this.runAction(() => this.service.simulateFail(paymentLink.id));
  }

  cancel(paymentLink: PaymentLinkItem): void {
    if (!this.canCancel(paymentLink)) return;
    this.runAction(() => this.service.cancel(paymentLink.id));
  }

  copy(paymentLink: PaymentLinkItem): void {
    navigator.clipboard?.writeText(paymentLink.checkoutUrl);
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 1800);
  }

  canSimulate(paymentLink: PaymentLinkItem): boolean {
    return !this.actionInProgress()
      && !['PAID', 'EXPIRED', 'CANCELLED'].includes(paymentLink.status)
      && paymentLink.pixCharge.status === 'OPEN';
  }

  canCancel(paymentLink: PaymentLinkItem): boolean {
    return !this.actionInProgress()
      && !['PAID', 'EXPIRED', 'CANCELLED'].includes(paymentLink.status);
  }

  attempts(paymentLink: PaymentLinkItem): PaymentObject[] {
    return paymentLink.attempts ?? [];
  }

  title(paymentLink: PaymentLinkItem): string {
    return paymentLink.title || paymentLink.description || 'Link avulso';
  }

  shortId(value?: string | null): string {
    if (!value) return '-';
    return value.length <= 12 ? value : `${value.slice(0, 8)}...`;
  }

  formatAttempt(payment: Pick<PaymentObject, 'attemptNumber' | 'attemptCount'>): string {
    return `Tentativa #${payment.attemptNumber ?? 1} de ${payment.attemptCount ?? 1}`;
  }

  isPaid(paymentLink: PaymentLinkItem): boolean {
    return paymentLink.status === 'PAID';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      ACTIVE: 'Ativo',
      OPENED: 'Aberto',
      PAID: 'Pago',
      EXPIRED: 'Expirado',
      CANCELLED: 'Cancelado',
    };
    return labels[status] ?? status;
  }

  statusIcon(status: string): string {
    const icons: Record<string, string> = {
      ACTIVE: 'lucideLink',
      OPENED: 'lucideClock',
      PAID: 'lucideCheckCircle2',
      EXPIRED: 'lucideXCircle',
      CANCELLED: 'lucideXCircle',
    };
    return icons[status] ?? 'lucideClock';
  }

  statusClass(status: PaymentLinkStatus): string {
    const classes: Record<PaymentLinkStatus, string> = {
      ACTIVE: 'border-blue-200 bg-blue-50 text-blue-700',
      OPENED: 'border-amber-200 bg-amber-50 text-amber-700',
      PAID: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      EXPIRED: 'border-zinc-200 bg-zinc-100 text-zinc-700',
      CANCELLED: 'border-red-200 bg-red-50 text-red-700',
    };
    return classes[status] ?? 'border-zinc-200 bg-zinc-100 text-zinc-700';
  }

  paymentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pendente',
      CONFIRMED: 'Confirmado',
      RELEASED: 'Liquidado',
      FAILED: 'Falhou',
      EXPIRED: 'Expirado',
      REFUNDED: 'Estornado',
    };
    return labels[status] ?? status;
  }

  paymentStatusIcon(status: string): string {
    if (status === 'CONFIRMED' || status === 'RELEASED') return 'lucideCheckCircle2';
    if (status === 'PENDING') return 'lucideClock';
    return 'lucideXCircle';
  }

  paymentStatusClass(status: string): string {
    if (status === 'CONFIRMED' || status === 'RELEASED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'PENDING') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-red-200 bg-red-50 text-red-700';
  }

  stateTitle(paymentLink: PaymentLinkItem): string {
    if (paymentLink.status === 'PAID') return 'Link pago e PixCharge fechada';
    if (paymentLink.status === 'CANCELLED') return 'Link cancelado';
    if (paymentLink.status === 'EXPIRED') return 'Link expirado';
    if (paymentLink.failedPaymentCount > 0) return 'Link aberto com tentativas falhas';
    return 'Link ativo aguardando pagamento';
  }

  stateDescription(paymentLink: PaymentLinkItem): string {
    if (paymentLink.status === 'PAID') return 'A cobrança comercial foi convertida. A PixCharge está paga e novas tentativas ficam bloqueadas.';
    if (paymentLink.status === 'CANCELLED') return 'A cobrança foi encerrada manualmente e não aceita novas tentativas.';
    if (paymentLink.status === 'EXPIRED') return 'O prazo da cobrança venceu e não deve aceitar novas tentativas.';
    if (paymentLink.failedPaymentCount > 0) return 'Falhas geram novos Payments, mas a PixCharge principal permanece aberta até uma confirmação, expiração ou cancelamento.';
    return 'Este Payment Link representa a cobrança principal. As tentativas aparecerão abaixo quando o checkout gerar Payments.';
  }

  devModeHint(paymentLink: PaymentLinkItem): string {
    if (this.actionInProgress()) return 'Ação em andamento...';
    if (this.canSimulate(paymentLink)) return 'Disponível porque o dashboard opera em ambiente TEST.';
    if (paymentLink.pixCharge.status !== 'OPEN') return 'Indisponível porque a PixCharge não está aberta.';
    return 'Indisponível para links pagos, expirados ou cancelados.';
  }

  private runAction(request: () => Observable<unknown>): void {
    this.actionInProgress.set(true);
    this.actionError.set(null);
    request()
      .pipe(finalize(() => this.actionInProgress.set(false)))
      .subscribe({
        next: () => this.load(),
        error: (err: Error) => this.actionError.set(err.message || 'Erro ao executar ação'),
      });
  }
}
