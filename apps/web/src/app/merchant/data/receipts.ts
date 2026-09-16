import { httpResource } from '@angular/common/http';
import { Signal, inject } from '@angular/core';

import type { ListParams } from '../domain/list-params';
import { MerchantApi } from './api';

export interface ReceiptRow {
  readonly id: string;
  readonly receiptNumber: string;
  readonly paymentId: string;
  readonly customerId?: string;
  readonly payerName?: string;
  readonly payerEmail?: string;
  readonly payerDocument?: string;
  readonly amount: number;
  readonly status: string;
  readonly issuedAt: string;
}

export interface ReceiptPage {
  readonly receipts: readonly ReceiptRow[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

export interface ReceiptQuery extends ListParams {
  readonly q: string;
  readonly page: number;
  readonly limit: number;
}

export const RECEIPT_QUERY: ReceiptQuery = { q: '', page: 1, limit: 20 };

export const EMPTY_RECEIPTS: ReceiptPage = {
  receipts: [],
  total: 0,
  page: 1,
  limit: RECEIPT_QUERY.limit,
  totalPages: 1,
};

/** A busca do lojista é por número do comprovante — é o que ele tem em mãos. */
export function receiptsParams(query: ReceiptQuery): Record<string, string | number> {
  return {
    page: query.page,
    limit: query.limit,
    ...(query.q.trim() ? { receiptNumber: query.q.trim() } : {}),
  };
}

export function receiptsResource(query: Signal<ReceiptQuery>) {
  const api = inject(MerchantApi);

  return httpResource<ReceiptPage>(() => api.request('/receipts', receiptsParams(query())), {
    defaultValue: EMPTY_RECEIPTS,
  });
}

/* ── O comprovante inteiro ───────────────────────────────────────────────── */

export interface ReceiptItem {
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly totalPrice: number;
}

/**
 * O comprovante como documento, e não como linha de lista.
 *
 * O que a lista não carrega e o detalhe precisa: quem recebeu, a taxa, o
 * líquido e os itens. É o único lugar do console onde a **decomposição do
 * valor** aparece para o pagador — bruto, taxa e líquido na mesma tela.
 */
export interface ReceiptDetail extends ReceiptRow {
  readonly storeId: string;
  readonly payeeName: string;
  readonly payeeDocument?: string;
  readonly fee: number;
  readonly netAmount: number;
  readonly currency: string;
  readonly description?: string;
  readonly items?: readonly ReceiptItem[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

const EMPTY_RECEIPT: ReceiptDetail = {
  id: '',
  receiptNumber: '',
  paymentId: '',
  amount: 0,
  status: 'PENDING',
  issuedAt: '',
  storeId: '',
  payeeName: '',
  fee: 0,
  netAmount: 0,
  currency: 'BRL',
  createdAt: '',
  updatedAt: '',
};

/** `id` vazio não busca nada — a rota ainda pode estar resolvendo. */
export function receiptResource(id: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<{ receipt: ReceiptDetail }>(
    () => (id() ? api.request(`/receipts/${id()}`) : undefined),
    { defaultValue: { receipt: EMPTY_RECEIPT } },
  );
}
