import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideReceipt, lucideUndo2 } from '@ng-icons/lucide';
import { Subscription, finalize } from 'rxjs';
import {
  GetPaymentTimelineResponseDto,
  PaymentObject,
  PaymentService,
  PaymentStatus,
  PaymentTimelineEvent,
  TransactionObject,
} from '../../../../core/services/payment.service';
import { RefundService } from '../../../../core/services/refund.service';
import {
  CopyValue,
  PageHeader,
  PageState,
  Sheet,
  StatusChip,
  type Tone,
} from '../../../../shared/ui';

function parseBrlToCents(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Math.round(value * 100);
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/** A timeline fala em `completed`/`pending`/`failed`; o design fala em tons. */
const TIMELINE_TONES: Readonly<Record<string, Tone>> = {
  completed: 'ok',
  pending: 'warn',
  failed: 'bad',
};

@Component({
  selector: 'app-payment-detail',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    NgIcon,
    ReactiveFormsModule,
    RouterLink,
    CopyValue,
    PageHeader,
    PageState,
    Sheet,
    StatusChip,
  ],
  providers: [provideIcons({ lucideArrowRight, lucideReceipt, lucideUndo2 })],
  templateUrl: './payment-detail.html',
  styleUrl: './payment-detail.css',
})
export class PaymentDetail implements OnInit, OnDestroy {
  readonly paymentService = inject(PaymentService);
  private readonly refundService = inject(RefundService);
  private readonly route = inject(ActivatedRoute);
  private routeSub?: Subscription;
  private activeRefundIdempotencyKey: string | null = null;
  private refundPaymentId: string | null = null;

  readonly refundDialogState = signal<'open' | 'closed'>('closed');
  readonly isRefundSubmitting = signal(false);
  readonly refundError = signal<string | null>(null);
  readonly refundForm = new FormGroup({
    amount: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const paymentId = params.get('id');

      if (!paymentId) {
        this.paymentService.clearTimelineState();
        return;
      }

      this.paymentService.loadPaymentTimeline(paymentId);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.paymentService.clearTimelineState();
  }

  openRefundDialog(payment: PaymentObject): void {
    if (!this.canRefund(payment)) return;
    this.refundPaymentId = payment.id;
    this.refundError.set(null);
    this.refundForm.reset({
      amount: this.formatMoneyInput(this.refundableAmount(payment)),
      reason: '',
    });
    this.refundForm.markAsPristine();
    this.refundForm.markAsUntouched();
    this.refundDialogState.set('open');
  }

  closeRefundDialog(): void {
    if (this.isRefundSubmitting()) return;
    this.refundDialogState.set('closed');
    this.refundError.set(null);
    this.refundPaymentId = null;
    this.activeRefundIdempotencyKey = null;
    this.refundForm.reset({ amount: '', reason: '' });
  }

  submitRefund(): void {
    const data = this.paymentService.currentTimeline();
    const payment = data?.payment;
    const amount = parseBrlToCents(this.refundForm.controls.amount.value);

    if (!payment || this.refundPaymentId !== payment.id || this.isRefundSubmitting()) return;
    if (
      !this.canRefund(payment) ||
      this.refundForm.invalid ||
      amount < 1 ||
      amount > this.refundableAmount(payment)
    ) {
      this.refundForm.markAllAsTouched();
      this.refundError.set(this.refundAmountError() || 'Revise os dados antes de continuar.');
      return;
    }

    this.isRefundSubmitting.set(true);
    this.refundError.set(null);
    this.activeRefundIdempotencyKey ??= this.refundService.createIdempotencyKey();

    this.refundService
      .create({
        paymentId: payment.id,
        amount,
        reason: this.refundForm.controls.reason.value.trim() || undefined,
        idempotencyKey: this.activeRefundIdempotencyKey,
      })
      .pipe(finalize(() => this.isRefundSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.activeRefundIdempotencyKey = null;
          this.refundDialogState.set('closed');
          this.paymentService.loadPaymentTimeline(payment.id);
        },
        error: (err) => {
          this.refundError.set(this.extractErrorMessage(err, 'Falha ao iniciar o estorno.'));
        },
      });
  }

  canRefund(payment: PaymentObject): boolean {
    return (
      (payment.status === PaymentStatus.CONFIRMED || payment.status === PaymentStatus.RELEASED) &&
      this.refundableAmount(payment) > 0
    );
  }

  canSubmitRefund(): boolean {
    const payment = this.paymentService.currentTimeline()?.payment;
    if (!payment || this.refundForm.invalid) return false;
    const amount = parseBrlToCents(this.refundForm.controls.amount.value);
    return !this.isRefundSubmitting() && amount > 0 && amount <= this.refundableAmount(payment);
  }

  refundableAmount(payment: PaymentObject): number {
    return Math.max(payment.amount - (payment.totalRefunded || 0), 0);
  }

  refundAmountError(): string | null {
    const payment = this.paymentService.currentTimeline()?.payment;
    const amount = parseBrlToCents(this.refundForm.controls.amount.value);
    const control = this.refundForm.controls.amount;

    if (!control.touched && !control.dirty) return null;
    if (amount < 1) return 'Informe um valor maior que zero.';
    if (payment && amount > this.refundableAmount(payment)) {
      return 'O valor passa do que ainda dá para estornar.';
    }
    return null;
  }

  formatRefundRemaining(): string {
    const payment = this.paymentService.currentTimeline()?.payment;
    return payment ? this.formatCurrency(this.refundableAmount(payment)) : '—';
  }

  shortId(value?: string | null): string {
    if (!value) return '—';
    return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
  }

  isPaymentLinkAttempt(payment: PaymentObject): boolean {
    return Boolean(
      payment.paymentLinkId ||
        payment.paymentOrigin === 'payment_link' ||
        payment.metadata?.['origin'] === 'payment_link',
    );
  }

  formatAttempt(payment: Pick<PaymentObject, 'attemptNumber' | 'attemptCount'>): string {
    return `Tentativa ${payment.attemptNumber ?? 1} de ${payment.attemptCount ?? 1}`;
  }

  getStateTitle(data: GetPaymentTimelineResponseDto): string {
    const map: Record<PaymentStatus, string> = {
      [PaymentStatus.PENDING]: 'Esperando o pagamento',
      [PaymentStatus.CONFIRMED]: 'Confirmado, esperando a liberação',
      [PaymentStatus.RELEASED]: 'Liquidado no saldo disponível',
      [PaymentStatus.REFUNDED]: 'Estornado',
      [PaymentStatus.FAILED]: 'Falhou antes de confirmar',
      [PaymentStatus.EXPIRED]: 'Expirou sem confirmação',
    };

    return map[data.payment.status] || 'Estado do pagamento';
  }

  getStateDescription(data: GetPaymentTimelineResponseDto): string {
    switch (data.payment.status) {
      case PaymentStatus.PENDING:
        return 'Ainda não há comprovante nem lançamento — e não deveria haver. O que existe é o prazo.';
      case PaymentStatus.CONFIRMED:
        return 'O recebimento entrou. Comprovante, lançamento de recebimento e entregas de webhook devem aparecer aqui assim que processarem.';
      case PaymentStatus.RELEASED:
        return 'O líquido saiu da posição a receber e entrou no disponível. Confira o lançamento de liberação e o saldo depois dele.';
      case PaymentStatus.REFUNDED:
        return 'Existe estorno registrado. Confira o total estornado, os refunds e o lançamento de débito.';
      case PaymentStatus.FAILED:
        return 'A cobrança falhou. Sem comprovante e sem lançamento de recebimento — é o esperado.';
      case PaymentStatus.EXPIRED:
        return 'O prazo venceu. A ausência de comprovante e de lançamentos é o esperado.';
      default:
        return 'Consulte a linha do tempo, o comprovante, os webhooks e o ledger.';
    }
  }

  getStateFacts(data: GetPaymentTimelineResponseDto): Array<{ label: string; value: string }> {
    const payment = data.payment;
    const facts: Array<{ label: string; value: string }> = [
      { label: 'Criado em', value: this.formatDateTime(payment.createdAt) },
      { label: 'Atualizado em', value: this.formatDateTime(payment.updatedAt) },
    ];

    switch (payment.status) {
      case PaymentStatus.PENDING:
        facts.push(
          { label: 'Expira em', value: this.formatDateTime(payment.expiresAt) },
          {
            label: 'Checkout',
            value: data.checkoutSession ? this.shortId(data.checkoutSession.id) : 'não vinculado',
          },
          {
            label: 'Comprovante',
            value: data.receipt ? data.receipt.receiptNumber : 'não emitido',
          },
        );
        break;
      case PaymentStatus.CONFIRMED:
        facts.push(
          { label: 'Pago em', value: this.formatDateTime(payment.paidAt) },
          {
            label: 'Comprovante',
            value: data.receipt ? data.receipt.receiptNumber : 'não emitido',
          },
          {
            label: 'Recebimento',
            value: this.transactionSummary(data.transactions, 'PAYMENT_RECEIVED'),
          },
          { label: 'Webhooks', value: `${data.webhookLogs.length} entrega(s)` },
        );
        break;
      case PaymentStatus.RELEASED:
        facts.push(
          { label: 'Liberado em', value: this.formatDateTime(payment.releasedAt) },
          {
            label: 'Liberação',
            value: this.transactionSummary(data.transactions, 'PAYMENT_RELEASED'),
          },
          {
            label: 'Impacto no saldo',
            value: this.balanceImpact(data.transactions, 'PAYMENT_RELEASED'),
          },
        );
        break;
      case PaymentStatus.REFUNDED:
        facts.push(
          { label: 'Total estornado', value: this.formatCurrency(payment.totalRefunded || 0) },
          { label: 'Refunds', value: `${data.refunds.length} registro(s)` },
          {
            label: 'Lançamento de estorno',
            value: this.transactionSummary(data.transactions, 'REFUND_DEDUCTED'),
          },
        );
        break;
      case PaymentStatus.FAILED:
        facts.push(
          { label: 'Motivo', value: payment.failedReason || 'não informado' },
          {
            label: 'Comprovante',
            value: data.receipt ? data.receipt.receiptNumber : 'ausente, como esperado',
          },
          {
            label: 'Lançamentos',
            value: data.transactions.length
              ? `${data.transactions.length} registro(s)`
              : 'ausentes, como esperado',
          },
        );
        break;
      case PaymentStatus.EXPIRED:
        facts.push(
          {
            label: 'Expirou em',
            value: this.formatDateTime(payment.expiresAt || payment.updatedAt),
          },
          {
            label: 'Comprovante',
            value: data.receipt ? data.receipt.receiptNumber : 'ausente, como esperado',
          },
          {
            label: 'Lançamentos',
            value: data.transactions.length
              ? `${data.transactions.length} registro(s)`
              : 'ausentes, como esperado',
          },
        );
        break;
    }

    return facts;
  }

  timelineTone(status: PaymentTimelineEvent['status']): Tone | null {
    return TIMELINE_TONES[status] ?? null;
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

  /** Entregue é bom; respondido com erro é ruim; sem resposta ainda está em voo. */
  webhookTone(log: { deliveredAt?: Date | string; responseStatus?: number }): Tone {
    if (log.deliveredAt) return 'ok';
    if (log.responseStatus) return 'bad';
    return 'warn';
  }

  hasEntries(value?: Record<string, unknown> | null): boolean {
    return Object.keys(value ?? {}).length > 0;
  }

  entries(value?: Record<string, unknown> | null): Array<{ key: string; value: unknown }> {
    return Object.entries(value ?? {}).map(([key, entryValue]) => ({ key, value: entryValue }));
  }

  stringify(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  formatTransactionType(type: string): string {
    const map: Record<string, string> = {
      PAYMENT_RECEIVED: 'Pagamento recebido',
      PAYMENT_RELEASED: 'Saldo liberado',
      REFUND_DEDUCTED: 'Estorno debitado',
      NEGATIVE_COMPENSATED: 'Compensação negativa',
      WITHDRAWAL_RESERVED: 'Saque reservado',
      WITHDRAWAL_SENT: 'Saque enviado',
      WITHDRAWAL_REVERSED: 'Saque revertido',
      FEE_CHARGED: 'Taxa',
      ADJUSTMENT: 'Ajuste',
    };
    return map[type] || type;
  }

  getCheckoutEmptyState(status: PaymentStatus): string {
    if (status === PaymentStatus.PENDING) return 'Cobrança direta, sem checkout hospedado.';
    return 'Nenhum checkout hospedado vinculado.';
  }

  getReceiptEmptyState(status: PaymentStatus): string {
    if (status === PaymentStatus.PENDING) return 'Sai junto com a confirmação do pagamento.';
    if (status === PaymentStatus.FAILED) return 'Ausente, como esperado para cobrança falha.';
    if (status === PaymentStatus.EXPIRED) return 'Ausente, como esperado para cobrança expirada.';
    return 'Não emitido, ou ainda em processamento.';
  }

  getRefundEmptyState(status: PaymentStatus): string {
    if (status === PaymentStatus.REFUNDED) {
      return 'Status estornado, mas a timeline não devolveu nenhum refund.';
    }
    return 'Nenhum estorno registrado.';
  }

  getTransactionEmptyState(status: PaymentStatus): string {
    if (status === PaymentStatus.PENDING) return 'Sem lançamentos enquanto a cobrança estiver de pé.';
    if (status === PaymentStatus.FAILED) return 'Sem lançamentos, como esperado.';
    if (status === PaymentStatus.EXPIRED) return 'Sem lançamentos, como esperado.';
    return 'A timeline não devolveu nenhum lançamento.';
  }

  getWebhookEmptyState(status: PaymentStatus): string {
    if (status === PaymentStatus.PENDING) return 'Nenhuma entrega registrada ainda.';
    return 'Sem entregas registradas para esta cobrança.';
  }

  private transactionSummary(transactions: TransactionObject[], type: string): string {
    const transaction = transactions.find((item) => item.type === type);
    if (!transaction) return 'não encontrada';
    return `${this.formatCurrency(transaction.netAmount)} (${this.shortId(transaction.id)})`;
  }

  private balanceImpact(transactions: TransactionObject[], type: string): string {
    const transaction = transactions.find((item) => item.type === type);
    if (!transaction) return 'não encontrado';
    return `saldo após ${this.formatCurrency(transaction.balanceAfter)}`;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      value / 100,
    );
  }

  private formatDateTime(value?: Date | string | null): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  private formatMoneyInput(cents: number): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const error = err as {
      message?: string;
      error?: { message?: string; error?: { message?: string } };
    };

    return error?.error?.error?.message || error?.error?.message || error?.message || fallback;
  }
}
