import { httpResource } from '@angular/common/http';
import { Signal, inject } from '@angular/core';

import type { ListParams } from '../domain/list-params';
import { MerchantApi } from './api';

export interface CustomerRow {
  readonly id: string;
  readonly externalId?: string;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly document: string;
  readonly formattedDocument: string;
  readonly documentType: 'CPF' | 'CNPJ';
  readonly createdAt: string;
}

export interface CustomerPage {
  readonly customers: readonly CustomerRow[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

export interface CustomerQuery extends ListParams {
  readonly q: string;
  readonly page: number;
  readonly limit: number;
}

export const CUSTOMER_QUERY: CustomerQuery = { q: '', page: 1, limit: 20 };

export const EMPTY_CUSTOMERS: CustomerPage = {
  customers: [],
  total: 0,
  page: 1,
  limit: CUSTOMER_QUERY.limit,
  totalPages: 1,
};

/** Uma busca só, que a API aplica em nome, e-mail, documento e external id. */
export function customersParams(query: CustomerQuery): Record<string, string | number> {
  return {
    page: query.page,
    limit: query.limit,
    ...(query.q.trim() ? { search: query.q.trim() } : {}),
  };
}

export function customersResource(query: Signal<CustomerQuery>) {
  const api = inject(MerchantApi);

  return httpResource<CustomerPage>(() => api.request('/customers', customersParams(query())), {
    defaultValue: EMPTY_CUSTOMERS,
  });
}

/** O nome que a lista mostra: o primeiro campo que identifica a pessoa. */
export function customerName(customer: CustomerRow): string {
  return customer.name || customer.email || customer.externalId || customer.formattedDocument;
}
