import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { chargeCommands, paymentTimelineResource } from '../../data/charges';
import { ledgerLabel } from '../../data/money';
import { parseReaisToCents } from '../../domain/api-contracts';
import { toApiFailure } from '../../domain/api-error';
import {
  DEFAULT_FAIL_REASON,
  type Outcome,
  type OutcomeAction,
  outcomesFor,
  refundBlocker,
  refundableAmount,
} from '../../domain/charge-outcomes';
import type { Tone } from '../../domain/tone';
import {
  MerButton,
  MerChip,
  MerCopy,
  MerField,
  MerNotice,
  MerPageHeader,
  MerPageState,
  MerPanel,
  MerSheet,
  MerStat,
} from '../../ui';

/** A timeline fala em `completed`/`pending`/`failed`; o desenho fala em tons. */
const EVENT_TONES: Readonly<Record<string, Tone>> = {
  completed: 'ok',
  pending: 'warn',
  failed: 'bad',
};

/**
 * O detalhe de uma cobrança: comprovante, ledger, webhooks, estornos — e,
 * agora, **o desfecho**.
 *
 * Duas coisas mudam em relação ao detalhe antigo:
 *
 * 1. **O lojista força o final.** `POST /dev/simulate/:id/*` existe na API
 *    desde sempre e o dashboard nunca chamou. A promessa da landing é "escolha
 *    o final"; ela passa a valer dentro do produto.
 * 2. **A grade para de cortar.** A antiga herda `detail-grid` de
 *    `primitives.css`, global, e em 1440 o painel da direita estoura a área de
 *    trabalho — que a casca esconde com `overflow`. Aqui a grade é local, com
 *    `minmax(0, 1fr)` nas duas colunas.
 */
@Component({
  selector: 'app-console-payment-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    MerButton,
    MerChip,
    MerCopy,
    MerField,
    MerNotice,
    MerPageHeader,
    MerPageState,
    MerPanel,
    MerSheet,
    MerStat,
  ],
  templateUrl: './payment-detail.html',
  styleUrl: './payment-detail.css',
})
export class ConsolePaymentDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly commands = chargeCommands();

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '' },
  );

  protected readonly data = paymentTimelineResource(this.id);

  protected readonly payment = computed(() => this.data.value()?.payment ?? null);
  protected readonly timeline = computed(() => this.data.value()?.timeline ?? []);
  protected readonly attempts = computed(() => this.data.value()?.relatedAttempts ?? []);
  protected readonly entries = computed(() => this.data.value()?.transactions ?? []);
  protected readonly webhooks = computed(() => this.data.value()?.webhookLogs ?? []);
  protected readonly refunds = computed(() => this.data.value()?.refunds ?? []);
  protected readonly receipt = computed(() => this.data.value()?.receipt ?? null);
  protected readonly checkout = computed(() => this.data.value()?.checkoutSession ?? null);

  protected readonly failure = computed(() =>
    this.data.error() ? toApiFailure(this.data.error()) : null,
  );

  protected readonly refundable = computed(() => {
    const payment = this.payment();
    return payment ? refundableAmount(payment.amount, payment.totalRefunded) : 0;
  });

  /* ── Forçar desfecho ────────────────────────────────────────────────── */
  protected readonly outcomes = computed(() => outcomesFor(this.payment()?.status ?? ''));
  protected readonly pendingOutcome = signal<Outcome | null>(null);
  protected readonly failReason = signal('');
  protected readonly running = signal(false);
  protected readonly outcomeError = signal('');

  protected ask(outcome: Outcome): void {
    this.outcomeError.set('');
    this.failReason.set('');
    this.pendingOutcome.set(outcome);
  }

  protected closeOutcome(): void {
    if (this.running()) return;
    this.pendingOutcome.set(null);
  }

  protected async runOutcome(): Promise<void> {
    const outcome = this.pendingOutcome();
    const id = this.payment()?.id;
    if (!outcome || !id || this.running()) return;

    this.running.set(true);
    const result = await this.execute(outcome.action, id);
    this.running.set(false);

    if (!result.ok) {
      this.outcomeError.set(result.failure.message);
      return;
    }

    this.pendingOutcome.set(null);
    this.data.reload();
  }

  private execute(action: OutcomeAction, id: string) {
    switch (action) {
      case 'confirm':
        return this.commands.confirmPayment(id);
      case 'release':
        return this.commands.releasePayment(id);
      case 'expire':
        return this.commands.expirePayment(id);
      case 'fail':
        return this.commands.failPayment(id, this.failReason().trim() || DEFAULT_FAIL_REASON);
    }
  }

  /* ── Estorno ────────────────────────────────────────────────────────── */
  protected readonly refundOpen = signal(false);
  protected readonly refundText = signal('');
  protected readonly refundReason = signal('');
  protected readonly refunding = signal(false);
  protected readonly refundError = signal('');

  protected readonly refundAmount = computed(() => parseReaisToCents(this.refundText()) ?? 0);

  protected readonly refundBlock = computed(() => {
    const payment = this.payment();
    if (!payment) return 'Cobrança não carregada.';

    return refundBlocker({
      status: payment.status,
      amount: payment.amount,
      totalRefunded: payment.totalRefunded,
      requested: this.refundAmount(),
    });
  });

  /** Só o botão de abrir olha o estornável; o resto é do `refundBlocker`. */
  protected readonly canOpenRefund = computed(() => {
    const payment = this.payment();
    if (!payment) return false;
    const status = payment.status as string;
    return (status === 'CONFIRMED' || status === 'RELEASED') && this.refundable() > 0;
  });

  protected openRefund(): void {
    if (!this.canOpenRefund()) return;
    this.refundError.set('');
    this.refundReason.set('');
    // Abre com o total estornável: estornar tudo é o caso comum, e digitar o
    // valor inteiro à mão é onde se erra uma casa decimal.
    this.refundText.set((this.refundable() / 100).toFixed(2).replace('.', ','));
    this.refundOpen.set(true);
  }

  protected closeRefund(): void {
    if (this.refunding()) return;
    this.refundOpen.set(false);
    this.refundError.set('');
  }

  protected async sendRefund(): Promise<void> {
    const payment = this.payment();
    const blocker = this.refundBlock();
    if (!payment || this.refunding()) return;

    if (blocker) {
      this.refundError.set(blocker);
      return;
    }

    const intent = { paymentId: payment.id, amount: this.refundAmount() };
    this.refunding.set(true);
    const result = await this.commands.refund({
      ...intent,
      reason: this.refundReason().trim() || undefined,
    });
    this.refunding.set(false);

    if (!result.ok) {
      this.refundError.set(result.failure.message);
      return;
    }

    this.commands.forgetRefund(intent);
    this.refundOpen.set(false);
    this.refundText.set('');
    this.data.reload();
  }

  /* ── Leitura ────────────────────────────────────────────────────────── */
  protected reload(): void {
    this.data.reload();
  }

  protected eventTone(status: string): Tone | null {
    return EVENT_TONES[status] ?? null;
  }

  /** Entregue é bom; respondido com erro é ruim; sem resposta segue em voo. */
  protected webhookTone(log: { deliveredAt?: string; responseStatus?: number }): Tone {
    if (log.deliveredAt) return 'ok';
    if (log.responseStatus) return 'bad';
    return 'warn';
  }

  protected entryLabel(type: string): string {
    return ledgerLabel(type);
  }

  protected eventAmount(event: { metadata?: Record<string, unknown> }): number | null {
    const value = event.metadata?.['amount'] ?? event.metadata?.['netAmount'];
    return typeof value === 'number' ? value : null;
  }

  protected isLinkAttempt(): boolean {
    const payment = this.payment();
    return Boolean(payment?.paymentLinkId || payment?.paymentOrigin === 'payment_link');
  }

  protected attemptLabel(attempt: { attemptNumber?: number; attemptCount?: number }): string {
    return `Tentativa ${attempt.attemptNumber ?? 1} de ${attempt.attemptCount ?? 1}`;
  }

  protected money(cents?: number | null): string {
    return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
