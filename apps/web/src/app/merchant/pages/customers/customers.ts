import { DatePipe } from '@angular/common';
import { Component, computed, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  CUSTOMER_QUERY,
  type CustomerRow,
  customerName,
  customersResource,
} from '../../data/customers';
import { listQuery } from '../../data/list-query';
import { toApiFailure } from '../../domain/api-error';
import {
  MerButton,
  MerField,
  MerPageHeader,
  MerPageState,
  MerPagination,
  MerPanel,
  MerTable,
} from '../../ui';

/**
 * Clientes: quem pagou, agrupado por documento.
 *
 * Uma busca só, porque a API aplica o mesmo termo em nome, e-mail, documento e
 * external id — quatro campos de busca aqui seriam quatro chances de procurar
 * no lugar errado.
 */
@Component({
  selector: 'app-console-customers',
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
    MerTable,
  ],
  templateUrl: './customers.html',
  styleUrl: './customers.css',
})
export class ConsoleCustomers {
  /** `protected` porque o template lê `query.touched()` para ligar o "limpar". */
  protected readonly query = listQuery(CUSTOMER_QUERY);

  protected readonly params = this.query.params;
  protected readonly customers = customersResource(this.params);
  protected readonly draft = linkedSignal(() => this.params().q);

  protected readonly page = computed(() => this.customers.value());
  protected readonly failure = computed(() =>
    this.customers.error() ? toApiFailure(this.customers.error()) : null,
  );
  protected readonly isEmpty = computed(
    () => !this.customers.isLoading() && this.page().customers.length === 0,
  );

  protected readonly emptyMessage = computed(() =>
    this.query.touched()
      ? 'Nenhum cliente corresponde à busca.'
      : 'Um cliente nasce na primeira cobrança identificada — com documento, e-mail ou external id.',
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
    this.customers.reload();
  }

  protected name(customer: CustomerRow): string {
    return customerName(customer);
  }

  protected contact(customer: CustomerRow): string {
    return customer.email || customer.phone || 'Sem contato adicional';
  }
}
