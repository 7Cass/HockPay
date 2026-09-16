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
