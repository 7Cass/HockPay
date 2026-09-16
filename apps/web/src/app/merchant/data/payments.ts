import { httpResource } from '@angular/common/http';
import { Signal, inject } from '@angular/core';

import type { ListPaymentsResponseDto, PaymentObject } from '../domain/api-contracts';
import type { ListParams } from '../domain/list-params';
import { MerchantApi } from './api';

/** O que a tela de pagamentos escolhe, e o que a URL guarda. */
export interface PaymentQuery extends ListParams {
  readonly q: string;
  readonly status: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly page: number;
  readonly limit: number;
}

export const PAYMENT_QUERY: PaymentQuery = {
  q: '',
  status: '',
  startDate: '',
  endDate: '',
  page: 1,
  limit: 20,
};

/**
 * A página vazia.
 *
 * `defaultValue` existe para a tela nunca precisar perguntar se o valor chegou:
 * enquanto carrega, a lista é uma lista vazia com `total: 0`, e não `undefined`
 * com três `?.` no template.
 */
export const EMPTY_PAGE: ListPaymentsResponseDto = {
  payments: [],
  total: 0,
  page: 1,
  limit: PAYMENT_QUERY.limit,
  totalPages: 1,
};

/**
 * O que a API recebe.
 *
 * Separado do recurso de propósito: a tradução entre o vocabulário da tela
 * (`q`, o que o lojista digitou) e o da API (`externalId`) é regra, e regra se
 * testa sem subir Angular nenhum.
 */
export function paymentsParams(query: PaymentQuery): Record<string, string | number> {
  return {
    page: query.page,
    limit: query.limit,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q.trim() ? { externalId: query.q.trim() } : {}),
    ...(query.startDate ? { startDate: query.startDate } : {}),
    ...(query.endDate ? { endDate: query.endDate } : {}),
  };
}

/**
 * A lista de pagamentos da loja, no ambiente da sessão.
 *
 * O recurso refaz sozinho quando a query muda, morre com a tela que o criou e
 * traz `value`, `isLoading`, `error` e `reload` prontos. É o contraste inteiro
 * com o `PaymentService` do dashboard antigo, que guarda dez sinais de estado
 * de tela num serviço global dividido por três páginas — duas delas mostrando o
 * `isLoading` uma da outra.
 */
export function paymentsResource(query: Signal<PaymentQuery>) {
  const api = inject(MerchantApi);

  return httpResource<ListPaymentsResponseDto>(
    () => api.request('/payments', paymentsParams(query())),
    { defaultValue: EMPTY_PAGE },
  );
}

export type { ListPaymentsResponseDto, PaymentObject };
