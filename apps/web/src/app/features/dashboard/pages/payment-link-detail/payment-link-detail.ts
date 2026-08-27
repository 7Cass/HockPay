import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideBan,
  lucideCheck,
  lucideCircleCheck,
  lucideCircleX,
  lucideCopy,
  lucideExternalLink,
  lucideReceipt,
  lucideRefreshCcw,
} from '@ng-icons/lucide';
import { Observable, Subscription, finalize } from 'rxjs';
import {
  PaymentLinkRecord,
  PaymentLinkService,
} from '../../../../core/services/payment-link.service';
import type { PaymentObject } from '../../../../core/services/payment.service';
import { CopyValue, PageHeader, PageState, Sheet, StatusChip } from '../../../../shared/ui';
import { linkTone } from '../payment-links/link-tone';

/** Estados em que a cobrança já morreu — nada mais entra por ela. */
const TERMINAL = ['PAID', 'EXPIRED', 'CANCELLED'];

@Component({
  selector: 'app-payment-link-detail',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    NgIcon,
    RouterLink,
    CopyValue,
    PageHeader,
    PageState,
    Sheet,
    StatusChip,
  ],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideBan,
      lucideCheck,
      lucideCircleCheck,
      lucideCircleX,
      lucideCopy,
      lucideExternalLink,
      lucideReceipt,
      lucideRefreshCcw,
    }),
  ],
  templateUrl: './payment-link-detail.html',
  styleUrl: './payment-link-detail.css',
})
export class PaymentLinkDetail implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PaymentLinkService);
  private routeSub?: Subscription;

  readonly link = signal<PaymentLinkRecord | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionInProgress = signal(false);
  readonly copied = signal(false);
  readonly cancelDialogState = signal<'open' | 'closed'>('closed');
  readonly linkToCancel = signal<PaymentLinkRecord | null>(null);
  readonly payDialogState = signal<'open' | 'closed'>('closed');
  readonly linkToPay = signal<PaymentLinkRecord | null>(null);
  readonly simulateDocument = signal('');
  readonly simulateName = signal('');
  readonly currentId = computed(() => this.link()?.id ?? null);

  readonly linkTone = linkTone;

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
    this.service
      .get(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => this.link.set(response.paymentLink),
        error: (err) => this.error.set(err.message || 'Erro ao carregar o link'),
      });
  }

  simulatePay(paymentLink: PaymentLinkRecord): void {
    if (!this.canSimulate(paymentLink)) return;
    this.linkToPay.set(paymentLink);
    this.simulateDocument.set('');
    this.simulateName.set('');
    this.payDialogState.set('open');
  }

  closePayDialog(): void {
    if (this.actionInProgress()) return;
    this.payDialogState.set('closed');
    this.linkToPay.set(null);
  }

  confirmSimulatePay(): void {
    const paymentLink = this.linkToPay();
    const document = this.simulateDocument().trim();
    if (!paymentLink || !this.canSimulate(paymentLink) || !document) return;
    const name = this.simulateName().trim();

    this.runAction(
      () => this.service.simulatePay(paymentLink.id, { document, name: name || undefined }),
      () => {
        this.payDialogState.set('closed');
        this.linkToPay.set(null);
      },
    );
  }

  simulateFail(paymentLink: PaymentLinkRecord): void {
    if (!this.canSimulate(paymentLink)) return;
    this.runAction(() => this.service.simulateFail(paymentLink.id));
  }

  cancel(paymentLink: PaymentLinkRecord): void {
    if (!this.canCancel(paymentLink)) return;
    this.linkToCancel.set(paymentLink);
    this.cancelDialogState.set('open');
  }

  closeCancelDialog(): void {
    if (this.actionInProgress()) return;
    this.cancelDialogState.set('closed');
    this.linkToCancel.set(null);
  }

  confirmCancel(): void {
    const paymentLink = this.linkToCancel();
    if (!paymentLink || !this.canCancel(paymentLink)) return;

    this.runAction(
      () => this.service.cancel(paymentLink.id),
      () => {
        this.cancelDialogState.set('closed');
        this.linkToCancel.set(null);
      },
    );
  }

  copy(paymentLink: PaymentLinkRecord): void {
    void navigator.clipboard?.writeText(paymentLink.checkoutUrl);
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 1800);
  }

  canSimulate(paymentLink: PaymentLinkRecord): boolean {
    return (
      !this.actionInProgress() &&
      !TERMINAL.includes(paymentLink.status) &&
      paymentLink.pixCharge.status === 'OPEN'
    );
  }

  canCancel(paymentLink: PaymentLinkRecord): boolean {
    return !this.actionInProgress() && !TERMINAL.includes(paymentLink.status);
  }

  attempts(paymentLink: PaymentLinkRecord): PaymentObject[] {
    return paymentLink.attempts ?? [];
  }

  title(paymentLink: PaymentLinkRecord): string {
    return paymentLink.title || paymentLink.description || 'Link avulso';
  }

  shortId(value?: string | null): string {
    if (!value) return '—';
    return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
  }

  formatAttempt(payment: Pick<PaymentObject, 'attemptNumber' | 'attemptCount'>): string {
    return `Tentativa ${payment.attemptNumber ?? 1} de ${payment.attemptCount ?? 1}`;
  }

  stateTitle(paymentLink: PaymentLinkRecord): string {
    if (paymentLink.status === 'PAID') return 'Pago, e a cobrança fechou';
    if (paymentLink.status === 'CANCELLED') return 'Cancelado';
    if (paymentLink.status === 'EXPIRED') return 'Expirado';
    if (paymentLink.failedPaymentCount > 0) return 'Aberto, com tentativas que falharam';
    return 'Ativo, esperando alguém pagar';
  }

  stateDescription(paymentLink: PaymentLinkRecord): string {
    if (paymentLink.status === 'PAID') {
      return 'A cobrança foi convertida. A PixCharge está paga e novas tentativas ficam bloqueadas.';
    }
    if (paymentLink.status === 'CANCELLED') {
      return 'A cobrança foi encerrada à mão e não aceita novas tentativas.';
    }
    if (paymentLink.status === 'EXPIRED') {
      return 'O prazo venceu. O checkout não deve mais aceitar tentativas.';
    }
    if (paymentLink.failedPaymentCount > 0) {
      return 'Cada falha gera um novo pagamento, mas a PixCharge principal segue aberta até uma confirmação, a expiração ou o cancelamento.';
    }
    return 'As tentativas aparecem abaixo assim que o checkout gerar o primeiro pagamento.';
  }

  devModeHint(paymentLink: PaymentLinkRecord): string {
    if (this.actionInProgress()) return 'Executando…';
    if (this.canSimulate(paymentLink)) return 'Disponível porque o dashboard opera em ambiente TEST.';
    if (paymentLink.pixCharge.status !== 'OPEN') return 'Indisponível: a PixCharge não está aberta.';
    return 'Indisponível para links pagos, expirados ou cancelados.';
  }

  private runAction(request: () => Observable<unknown>, afterSuccess?: () => void): void {
    this.actionInProgress.set(true);
    this.actionError.set(null);
    request()
      .pipe(finalize(() => this.actionInProgress.set(false)))
      .subscribe({
        next: () => {
          afterSuccess?.();
          this.load();
        },
        error: (err: Error) => this.actionError.set(err.message || 'Erro ao executar a ação'),
      });
  }
}
