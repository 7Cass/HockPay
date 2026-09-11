import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import type { BankAccount } from '../../../domain/api-contracts';
import { WITHDRAWAL_POLICY, formatCents, parseReaisToCents } from '../../../domain/money';
import {
  OperatorMoneyService,
  type OperatorWithdrawalResult,
} from '../../../services/operator-money.service';
import type { OperatorEnvironment } from '../../../services/operator-investigation.service';
import {
  AdmButton,
  AdmFact,
  AdmFacts,
  AdmField,
  AdmNotice,
  AdmPageState,
  AdmSheet,
} from '../../../ui';
import { sendErrorMessage } from './send-error';

type Step = 'fill' | 'confirm';

/**
 * A mesa sacando pela loja.
 *
 * Dois passos, e o segundo não é formalidade: é a primeira tela da mesa que
 * move dinheiro, e a confirmação repete em prosa o que vai acontecer — quanto
 * sai, de qual ledger, para qual chave, com qual taxa. O botão final carrega o
 * valor e o ambiente, para que ninguém confirme um saque LIVE achando que é
 * TEST.
 *
 * O ambiente não é escolhido aqui. Ele vem da investigação, que é onde o saldo
 * foi lido: sacar de um ledger diferente do que está na tela seria decidir com
 * um número e mover outro.
 *
 * A mesa não cadastra destino pela loja. Sem destino verificado, a tela diz
 * isso em vez de mostrar um select vazio — o destino é da loja, e cadastrá-lo é
 * trabalho do lojista, não de quem atende o chamado.
 */
@Component({
  selector: 'app-operator-withdraw-sheet',
  standalone: true,
  imports: [
    CurrencyPipe,
    AdmButton,
    AdmFact,
    AdmFacts,
    AdmField,
    AdmNotice,
    AdmPageState,
    AdmSheet,
  ],
  templateUrl: './withdraw-sheet.html',
  styleUrl: './money-sheet.css',
})
export class OperatorWithdrawSheet implements OnInit {
  readonly storeId = input.required<string>();
  readonly storeName = input.required<string>();
  readonly environment = input.required<OperatorEnvironment>();

  /** O disponível do ledger do ambiente, em centavos, como a investigação leu. */
  readonly available = input.required<number>();

  readonly done = output<OperatorWithdrawalResult>();
  readonly closed = output<void>();

  private readonly money = inject(OperatorMoneyService);

  protected readonly policy = WITHDRAWAL_POLICY;

  protected readonly step = signal<Step>('fill');
  protected readonly destinations = signal<BankAccount[] | null>(null);
  protected readonly destinationsError = signal<string | null>(null);
  protected readonly bankAccountId = signal('');
  protected readonly amountText = signal('');
  protected readonly reason = signal('');
  protected readonly isSending = signal(false);
  protected readonly sendError = signal<string | null>(null);

  ngOnInit(): void {
    this.money.listBankAccounts(this.storeId()).subscribe({
      next: (accounts) => {
        this.destinations.set(accounts);

        // Começa no destino padrão, se ele puder receber. Um padrão não
        // verificado não é sugestão, é armadilha.
        const preferred = accounts.find((account) => account.isDefault && account.isVerified);
        if (preferred) this.bankAccountId.set(preferred.id);
      },
      error: (err: HttpErrorResponse) => {
        this.destinationsError.set(
          err.error?.error?.message || 'Não foi possível ler os destinos Pix da loja.',
        );
      },
    });
  }

  protected readonly verifiedCount = computed(
    () => this.destinations()?.filter((account) => account.isVerified).length ?? 0,
  );

  protected readonly destination = computed(
    () => this.destinations()?.find((account) => account.id === this.bankAccountId()) ?? null,
  );

  protected readonly amount = computed(() => parseReaisToCents(this.amountText()));

  /** Vazio enquanto não houver o que dizer; a frase é a própria condição. */
  protected readonly amountError = computed(() => {
    if (!this.amountText().trim()) return '';

    const amount = this.amount();
    if (amount === null) return 'em reais, como 1.234,56';
    if (amount < this.policy.minAmountInCents) {
      return `mínimo de ${formatCents(this.policy.minAmountInCents)}`;
    }
    if (amount > this.policy.maxAmountInCents) {
      return `máximo de ${formatCents(this.policy.maxAmountInCents)} por saque`;
    }
    if (amount > this.available()) return `maior que o disponível em ${this.environment()}`;
    return '';
  });

  protected readonly net = computed(() => (this.amount() ?? 0) - this.policy.feeInCents);

  protected readonly canReview = computed(
    () =>
      !!this.destination()?.isVerified &&
      this.amount() !== null &&
      !this.amountError() &&
      this.reason().trim().length > 0,
  );

  protected setDestination(event: Event): void {
    this.bankAccountId.set((event.target as HTMLSelectElement).value);
  }

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
      .withdraw(this.storeId(), {
        bankAccountId: this.bankAccountId(),
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
          this.sendError.set(sendErrorMessage(err, 'Não foi possível sacar.'));
        },
      });
  }
}
