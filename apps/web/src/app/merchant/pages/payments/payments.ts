import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { listQuery } from '../../data/list-query';
import { PAYMENT_QUERY, paymentsResource } from '../../data/payments';
import { toApiFailure } from '../../domain/api-error';
import {
  MerButton,
  MerChip,
  MerField,
  MerPageHeader,
  MerPageState,
  MerPagination,
  MerPanel,
  MerTable,
} from '../../ui';

const STATUS = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'RELEASED', label: 'Liquidado' },
  { value: 'FAILED', label: 'Falhou' },
  { value: 'EXPIRED', label: 'Expirado' },
  { value: 'REFUNDED', label: 'Estornado' },
];

/**
 * Pagamentos: toda cobrança Pix da loja, no ambiente da sessão.
 *
 * A tela não guarda estado de lista — quem guarda é a URL, e o recurso reage a
 * ela. O que existe aqui de estado é o rascunho da busca, que só vira filtro
 * quando o lojista confirma: refazer a requisição a cada tecla digitada gasta
 * uma chamada por caractere e faz a lista tremer embaixo do ponteiro.
 */
@Component({
  selector: 'app-console-payments',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MerButton,
    MerChip,
    MerField,
    MerPageHeader,
    MerPageState,
    MerPagination,
    MerPanel,
    MerTable,
  ],
  templateUrl: './payments.html',
  styleUrl: './payments.css',
})
export class ConsolePayments {
  /** `protected` porque o template lê `query.touched()` para ligar o "limpar". */
  protected readonly query = listQuery(PAYMENT_QUERY);

  protected readonly params = this.query.params;
  protected readonly payments = paymentsResource(this.params);
  protected readonly statusOptions = STATUS;

  /** O rascunho segue a URL, e volta a segui-la quando ela muda por fora. */
  protected readonly draft = linkedSignal(() => this.params().q);

  protected readonly page = computed(() => this.payments.value());
  protected readonly failure = computed(() =>
    this.payments.error() ? toApiFailure(this.payments.error()) : null,
  );
  protected readonly isEmpty = computed(
    () => !this.payments.isLoading() && this.page().payments.length === 0,
  );

  protected readonly emptyMessage = computed(() =>
    this.query.touched()
      ? 'Nenhum pagamento corresponde aos filtros. Amplie o período ou solte o status.'
      : 'Assim que a primeira cobrança for criada, ela aparece aqui com taxa e líquido.',
  );

  protected search(): void {
    this.query.set({ q: this.draft().trim() });
  }

  protected setStatus(value: string): void {
    this.query.set({ status: value });
  }

  protected setStart(value: string): void {
    this.query.set({ startDate: value });
  }

  protected setEnd(value: string): void {
    this.query.set({ endDate: value });
  }

  protected clear(): void {
    this.query.clear();
  }

  protected goTo(page: number): void {
    this.query.page(page);
  }

  protected reload(): void {
    this.payments.reload();
  }

  /** Id curto para a linha: o inteiro cabe no detalhe, não na lista. */
  protected short(value?: string | null): string {
    if (!value) return '—';
    return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
  }

  protected isLinkAttempt(payment: { paymentLinkId?: string; paymentOrigin?: string }): boolean {
    return Boolean(payment.paymentLinkId || payment.paymentOrigin === 'payment_link');
  }
}
