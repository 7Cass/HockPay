import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { listQuery } from '../../data/list-query';
import {
  LEDGER_LABELS,
  LEDGER_QUERY,
  type LedgerEntry,
  accountResource,
  ledgerLabel,
  ledgerResource,
} from '../../data/money';
import { MerchantSession } from '../../data/session';
import { toApiFailure } from '../../domain/api-error';
import {
  MerButton,
  MerField,
  MerPageHeader,
  MerPageState,
  MerPagination,
  MerPanel,
  MerStat,
  MerTable,
} from '../../ui';

const TYPES = [
  { value: '', label: 'Todos os tipos' },
  ...Object.entries(LEDGER_LABELS).map(([value, label]) => ({ value, label })),
];

/**
 * Saldo e Extrato: o ledger do ambiente da sessão, linha a linha.
 *
 * A tela diz **qual** ledger está mostrando. LIVE aqui é saldo simulado, e um
 * saldo LIVE apresentado como saldo de verdade seria a mentira mais cara que
 * este simulador consegue contar.
 */
@Component({
  selector: 'app-console-financials',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    MerButton,
    MerField,
    MerPageHeader,
    MerPageState,
    MerPagination,
    MerPanel,
    MerStat,
    MerTable,
  ],
  templateUrl: './financials.html',
  styleUrl: './financials.css',
})
export class ConsoleFinancials {
  private readonly session = inject(MerchantSession);

  protected readonly query = listQuery(LEDGER_QUERY);
  protected readonly params = this.query.params;
  protected readonly types = TYPES;

  protected readonly account = accountResource();
  protected readonly ledger = ledgerResource(this.params);

  protected readonly balance = computed(() => this.account.value().account);
  protected readonly currency = computed(() => this.balance().currency || 'BRL');
  protected readonly page = computed(() => this.ledger.value());

  protected readonly failure = computed(() => {
    const error = this.ledger.error() ?? this.account.error();
    return error ? toApiFailure(error) : null;
  });

  protected readonly isEmpty = computed(
    () => !this.ledger.isLoading() && this.page().data.length === 0,
  );

  protected readonly ledgerNote = computed(() =>
    this.session.isLive()
      ? 'O saldo LIVE da loja — simulado. Não existe adquirente: nenhum dinheiro real se move, e o ledger TEST é separado.'
      : 'O saldo TEST da loja. LIVE tem um ledger separado, e você troca de ambiente na barra do topo.',
  );

  protected readonly emptyMessage = computed(() =>
    this.query.touched()
      ? 'Nenhum lançamento no tipo ou no período escolhido.'
      : 'Pagamentos, liberações, taxas e saques aparecem aqui, um a um.',
  );

  protected label(type: string): string {
    return ledgerLabel(type);
  }

  protected setType(value: string): void {
    this.query.set({ type: value });
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
    this.account.reload();
    this.ledger.reload();
  }

  protected money(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: this.currency(),
    });
  }

  protected short(value?: string | null): string {
    if (!value) return '—';
    return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
  }

  /** No extrato o sinal é a informação — é o único lugar onde valor ganha cor. */
  protected sign(value: number): 'pos' | 'neg' | null {
    if (value > 0) return 'pos';
    if (value < 0) return 'neg';
    return null;
  }

  protected isPayment(entry: LedgerEntry): boolean {
    const type = entry.referenceType?.toUpperCase();
    return type === 'PAYMENT' && !!entry.referenceId;
  }
}
