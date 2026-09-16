import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { listQuery } from '../../data/list-query';
import { RECEIPT_QUERY, receiptsResource } from '../../data/receipts';
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

/**
 * Comprovantes: o documento que a loja emite quando um pagamento confirma.
 *
 * A busca é pelo número do comprovante porque é o que o comprador manda de
 * volta quando reclama — ele não tem o id do pagamento, tem o papel.
 */
@Component({
  selector: 'app-console-receipts',
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
  templateUrl: './receipts.html',
  styleUrl: './receipts.css',
})
export class ConsoleReceipts {
  /** `protected` porque o template lê `query.touched()` para ligar o "limpar". */
  protected readonly query = listQuery(RECEIPT_QUERY);

  protected readonly params = this.query.params;
  protected readonly receipts = receiptsResource(this.params);
  protected readonly draft = linkedSignal(() => this.params().q);

  protected readonly page = computed(() => this.receipts.value());
  protected readonly failure = computed(() =>
    this.receipts.error() ? toApiFailure(this.receipts.error()) : null,
  );
  protected readonly isEmpty = computed(
    () => !this.receipts.isLoading() && this.page().receipts.length === 0,
  );

  protected readonly emptyMessage = computed(() =>
    this.query.touched()
      ? 'Nenhum comprovante com esse número.'
      : 'O comprovante é emitido junto com a confirmação do pagamento.',
  );

  protected search(): void {
    this.query.set({ q: this.draft().trim() });
  }

  protected clear(): void {
    this.query.clear();
  }

  protected goTo(page: number): void {
    this.query.page(page);
  }

  protected reload(): void {
    this.receipts.reload();
  }

  protected payer(receipt: { payerName?: string }): string {
    return receipt.payerName || 'Não identificado';
  }

  protected payerDetail(receipt: { payerEmail?: string; payerDocument?: string }): string {
    return receipt.payerEmail || receipt.payerDocument || 'Sem dados adicionais';
  }
}
