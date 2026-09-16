import { httpResource } from '@angular/common/http';
import { Signal, inject } from '@angular/core';

import type { ListPaymentsResponseDto } from '../domain/api-contracts';
import type { ListParams } from '../domain/list-params';
import { MerchantApi } from './api';
import { EMPTY_PAGE } from './payments';
import { EMPTY_RECEIPTS, type ReceiptPage } from './receipts';

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

/* ── O cliente inteiro ───────────────────────────────────────────────────── */

/**
 * O cadastro completo, com endereço e metadata.
 *
 * A lista mostra quem é; o detalhe mostra o que se sabe. Nada aqui é editável
 * pelo console — `PATCH /customers/:externalId` existe na API e nunca teve
 * tela, e continua sem: abrir edição de cadastro é decisão de produto, não
 * acabamento de migração.
 */
export interface CustomerDetail extends CustomerRow {
  readonly storeId: string;
  readonly street?: string;
  readonly number?: string;
  readonly complement?: string;
  readonly city?: string;
  readonly state?: string;
  readonly zipCode?: string;
  readonly country?: string;
  readonly metadata?: Record<string, unknown>;
  readonly updatedAt: string;
}

const EMPTY_CUSTOMER: CustomerDetail = {
  id: '',
  document: '',
  formattedDocument: '',
  documentType: 'CPF',
  createdAt: '',
  storeId: '',
  updatedAt: '',
};

/**
 * O cliente pelo **id interno**, e não pelo `externalId`.
 *
 * A API tem as duas rotas: `GET /customers/:externalId` e
 * `GET /customers/id/:id`. A lista linka pelo uuid — que é o único
 * identificador que todo cliente tem, porque `externalId` é opcional —, então o
 * detalhe precisa da segunda. Pedir `/customers/<uuid>` cai na primeira e volta
 * `Customer not found with externalId`, que foi exatamente o que a captura
 * desta fatia pegou.
 */
export function customerResource(id: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<{ customer: CustomerDetail }>(
    () => (id() ? api.request(`/customers/id/${id()}`) : undefined),
    { defaultValue: { customer: EMPTY_CUSTOMER } },
  );
}

/** O endereço em uma linha, com o que existir. */
export function addressLine(customer: CustomerDetail): string {
  const street = [customer.street, customer.number].filter(Boolean).join(', ');
  return [street, customer.complement].filter(Boolean).join(' — ');
}

/** Cidade, estado e CEP, também com o que existir. */
export function locationLine(customer: CustomerDetail): string {
  const place = [customer.city, customer.state].filter(Boolean).join('/');
  return [place, customer.zipCode].filter(Boolean).join(' · ');
}

/* ── O que este cliente moveu ────────────────────────────────────────────── */

/**
 * Os últimos pagamentos e comprovantes **deste** cliente.
 *
 * `customerId` é filtro de verdade nas duas rotas — conferido em
 * `list-payments.dto.ts` e `list-receipts.dto.ts`, e não deduzido da tela
 * antiga. Dez linhas bastam: quem quiser a lista inteira tem a tela de
 * Pagamentos, e o detalhe do cliente existe para responder "ele já comprou?",
 * não para paginar.
 */
export function customerPaymentsResource(id: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<ListPaymentsResponseDto>(
    () => (id() ? api.request('/payments', { customerId: id(), page: 1, limit: 10 }) : undefined),
    { defaultValue: EMPTY_PAGE },
  );
}

export function customerReceiptsResource(id: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<ReceiptPage>(
    () => (id() ? api.request('/receipts', { customerId: id(), page: 1, limit: 10 }) : undefined),
    { defaultValue: EMPTY_RECEIPTS },
  );
}
