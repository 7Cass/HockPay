import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { PaymentStatus, type PaymentObject } from '../../../domain/api-contracts';
import { centsToReaisText, formatCents, parseReaisToCents } from '../../../domain/money';
import {
  OperatorMoneyService,
  type OperatorRefundResult,
} from '../../../services/operator-money.service';
import type { OperatorEnvironment } from '../../../services/operator-investigation.service';
import { AdmButton, AdmFact, AdmFacts, AdmField, AdmNotice, AdmSheet } from '../../../ui';
import { sendErrorMessage } from './send-error';

type Step = 'fill' | 'confirm';

/**
 * A mesa estornando pela loja.
 *
 * Mesmos dois passos do saque, e pela mesma razão. O que muda é de onde o
 * dinheiro sai: pagamento confirmado ainda não liberou, então o estorno sai do
 * "a liberar"; pagamento liberado já está no disponível, e sai de lá. A tela
 * diz qual, porque é a pergunta que o lojista vai fazer depois.
 *
 * O ambiente vai para a API como conferência: quem sabe o ledger é o
 * pagamento, e a API recusa se a mesa disser outro. A tela manda o ambiente que
 * está investigando — que, numa lista filtrada por ambiente, é o do pagamento.
 */
@Component({
  selector: 'app-operator-refund-sheet',
  standalone: true,
  imports: [CurrencyPipe, AdmButton, AdmFact, AdmFacts, AdmField, AdmNotice, AdmSheet],
  templateUrl: './refund-sheet.html',
  styleUrl: './money-sheet.css',
})
export class OperatorRefundSheet implements OnInit {
  readonly storeId = input.required<string>();
  readonly storeName = input.required<string>();
  readonly environment = input.required<OperatorEnvironment>();
  readonly payment = input.required<PaymentObject>();

  readonly done = output<OperatorRefundResult>();
  readonly closed = output<void>();

  private readonly money = inject(OperatorMoneyService);

  protected readonly step = signal<Step>('fill');
  protected readonly amountText = signal('');
  protected readonly reason = signal('');
  protected readonly isSending = signal(false);
  protected readonly sendError = signal<string | null>(null);

  /** O valor começa no que falta estornar: o chamado mais comum é o total. */
  ngOnInit(): void {
    this.amountText.set(centsToReaisText(this.refundable()));
  }

  protected readonly refundable = computed(
    () => this.payment().amount - (this.payment().totalRefunded ?? 0),
  );

  protected readonly amount = computed(() => parseReaisToCents(this.amountText()));

  protected readonly amountError = computed(() => {
    if (!this.amountText().trim()) return '';

    const amount = this.amount();
    if (amount === null) return 'em reais, como 1.234,56';
    if (amount < 1) return `mínimo de ${formatCents(1)}`;
    if (amount > this.refundable()) {
      return `maior que o estornável, ${formatCents(this.refundable())}`;
    }
    return '';
  });

  /**
   * A taxa volta na proporção do estorno, arredondada — a mesma conta do
   * `CreateRefundUseCase`. O que sai do saldo da loja é o valor menos essa
   * parte, porque a taxa nunca chegou a ser dela.
   */
  protected readonly feeRefunded = computed(() => {
    const payment = this.payment();
    return Math.round(payment.fee * ((this.amount() ?? 0) / payment.amount));
  });

  protected readonly deduction = computed(() => (this.amount() ?? 0) - this.feeRefunded());

  /** Confirmado ainda está a liberar; liberado já está disponível. */
  protected readonly source = computed(() =>
    this.payment().status === PaymentStatus.CONFIRMED ? 'a liberar' : 'disponível',
  );

  protected readonly isFull = computed(() => this.amount() === this.refundable());

  protected readonly canReview = computed(
    () => this.amount() !== null && !this.amountError() && this.reason().trim().length > 0,
  );

  protected setAmount(event: Event): void {
    this.amountText.set((event.target as HTMLInputElement).value);
  }

  protected setReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected review(): void {
    if (!this.canReview()) return;
    this.sendError.set(null);
    this.step.set('confirm');
  }

  protected back(): void {
    this.sendError.set(null);
    this.step.set('fill');
  }

  protected confirm(): void {
    const amount = this.amount();
    if (!this.canReview() || amount === null || this.isSending()) return;

    this.isSending.set(true);
    this.sendError.set(null);

    this.money
      .refund(this.storeId(), {
        paymentId: this.payment().id,
        amount,
        environment: this.environment(),
        reason: this.reason(),
      })
      .subscribe({
        next: (result) => {
          this.isSending.set(false);
          this.done.emit(result);
        },
        error: (err: HttpErrorResponse) => {
          this.isSending.set(false);
          this.sendError.set(sendErrorMessage(err, 'Não foi possível estornar.'));
        },
      });
  }
}
