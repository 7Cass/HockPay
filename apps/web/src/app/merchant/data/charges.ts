import { httpResource } from '@angular/common/http';
import { Signal, inject } from '@angular/core';

import type { PaymentObject } from '../domain/api-contracts';
import type { ListParams } from '../domain/list-params';
import { MerchantApi, type Result } from './api';
import type { LedgerEntry } from './money';

/* ── Pagamento: a linha do tempo ─────────────────────────────────────────── */

export interface TimelineEvent {
  readonly id: string;
  readonly type: string;
  readonly status: 'completed' | 'pending' | 'failed' | 'neutral';
  readonly title: string;
  readonly description?: string;
  readonly occurredAt: string;
  readonly entityId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface WebhookDelivery {
  readonly id: string;
  readonly eventType: string;
  readonly deliveryId: string;
  readonly requestId?: string;
  readonly responseStatus?: number;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly deliveredAt?: string;
  readonly createdAt: string;
}

export interface Receipt {
  readonly id: string;
  readonly receiptNumber: string;
  readonly issuedAt: string;
}

export interface Refund {
  readonly id: string;
  readonly amount: number;
  readonly feeRefunded: number;
  readonly reason?: string;
  readonly status: string;
  readonly processedAt?: string;
  readonly createdAt: string;
}

export interface PaymentTimeline {
  readonly payment: PaymentObject;
  readonly relatedAttempts: readonly PaymentObject[];
  readonly checkoutSession?: { id: string; status: string; expiresAt?: string } | null;
  readonly receipt?: Receipt | null;
  readonly refunds: readonly Refund[];
  readonly transactions: readonly LedgerEntry[];
  readonly webhookLogs: readonly WebhookDelivery[];
  readonly timeline: readonly TimelineEvent[];
}

/**
 * Tudo que aconteceu com uma cobrança, numa leitura só.
 *
 * A API já devolve pagamento, tentativas, comprovante, estornos, lançamentos e
 * entregas de webhook juntos — a tela não precisa costurar seis chamadas, e não
 * deveria: seis respostas chegando fora de ordem é como o detalhe antigo
 * mostra um estado meio pronto por alguns quadros.
 */
export function paymentTimelineResource(id: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<PaymentTimeline | undefined>(() =>
    id() ? api.request(`/payments/${id()}/timeline`) : undefined,
  );
}

/* ── Links de pagamento ──────────────────────────────────────────────────── */

export type LinkStatus = 'ACTIVE' | 'OPENED' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export interface PaymentLink {
  readonly id: string;
  readonly publicToken: string;
  readonly amount: number;
  readonly title: string | null;
  readonly description: string | null;
  readonly internalReference: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly checkoutUrl: string;
  readonly status: LinkStatus;
  readonly paymentId: string | null;
  readonly failedPaymentCount: number;
  readonly lastPaymentId: string | null;
  readonly pixCharge: {
    readonly id: string;
    readonly status: string;
    readonly pixTxId: string;
    readonly expiresAt: string | null;
    readonly paidAt?: string | null;
  };
  readonly attempts?: readonly PaymentObject[];
}

export interface LinkStats {
  readonly total: number;
  readonly active: number;
  readonly opened: number;
  readonly paid: number;
  readonly expired: number;
  readonly cancelled: number;
  readonly conversionRate: number;
  readonly paidAmount: number;
}

export interface LinkPage {
  readonly items: readonly PaymentLink[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly stats: LinkStats;
}

export interface LinkQuery extends ListParams {
  readonly status: string;
  readonly page: number;
  readonly limit: number;
}

export const LINK_QUERY: LinkQuery = { status: '', page: 1, limit: 20 };

export const EMPTY_STATS: LinkStats = {
  total: 0,
  active: 0,
  opened: 0,
  paid: 0,
  expired: 0,
  cancelled: 0,
  conversionRate: 0,
  paidAmount: 0,
};

export const EMPTY_LINKS: LinkPage = {
  items: [],
  total: 0,
  page: 1,
  limit: LINK_QUERY.limit,
  totalPages: 1,
  stats: EMPTY_STATS,
};

/**
 * `failures` não é um status da API: é um filtro sobre links vivos que já
 * colecionaram tentativa falha. A API o recebe como `hasFailures`, e a tela o
 * mostra ao lado dos status porque, para quem cobra, "tem falha" é um estado.
 */
export function linksParams(query: LinkQuery): Record<string, string | number | boolean> {
  return {
    page: query.page,
    limit: query.limit,
    ...(query.status === 'failures'
      ? { hasFailures: true }
      : query.status
        ? { status: query.status }
        : {}),
  };
}

export function linksResource(query: Signal<LinkQuery>) {
  const api = inject(MerchantApi);

  return httpResource<LinkPage>(() => api.request('/payment-links', linksParams(query())), {
    defaultValue: EMPTY_LINKS,
  });
}

export function linkResource(id: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<{ paymentLink: PaymentLink } | undefined>(() =>
    id() ? api.request(`/payment-links/${id()}`) : undefined,
  );
}

/* ── Catálogo, para o link que cobra por itens ───────────────────────────── */

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly price: number;
}

export function productSearchResource(term: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<{ products: readonly Product[] }>(
    () =>
      api.request('/products', {
        isActive: true,
        limit: 20,
        ...(term().trim() ? { search: term().trim() } : {}),
      }),
    { defaultValue: { products: [] } },
  );
}

/* ── Comandos ────────────────────────────────────────────────────────────── */

export interface LinkInput {
  readonly amount?: number;
  readonly items?: readonly { productId: string; quantity: number }[];
  readonly title?: string;
  readonly description?: string;
  readonly internalReference?: string;
  readonly expiresAt?: string;
}

/**
 * As escritas da cobrança.
 *
 * **Forçar o desfecho** é a capacidade que o console ganha aqui: a API tem
 * `POST /dev/simulate/:id/{confirm|fail|expire|release}` desde sempre, e o
 * dashboard antigo nunca as chamou. O motivo da falha vai por query string,
 * que é como o controller o lê.
 */
export class ChargeCommands {
  constructor(private readonly api: MerchantApi) {}

  /** A chave é da intenção — mesmo pagamento e mesmo valor repetem a chave. */
  refund(input: { paymentId: string; amount: number; reason?: string }): Promise<Result<unknown>> {
    return this.api.post(
      '/refunds',
      { paymentId: input.paymentId, amount: input.amount, reason: input.reason },
      { intent: `refund:${input.paymentId}:${input.amount}` },
    );
  }

  forgetRefund(input: { paymentId: string; amount: number }): void {
    this.api.forget(`refund:${input.paymentId}:${input.amount}`);
  }

  confirmPayment(id: string): Promise<Result<{ payment: PaymentObject }>> {
    return this.api.post(`/dev/simulate/${id}/confirm`, {});
  }

  releasePayment(id: string): Promise<Result<{ payment: PaymentObject }>> {
    return this.api.post(`/dev/simulate/${id}/release`, {});
  }

  expirePayment(id: string): Promise<Result<{ payment: PaymentObject }>> {
    return this.api.post(`/dev/simulate/${id}/expire`, {});
  }

  failPayment(id: string, reason: string): Promise<Result<{ payment: PaymentObject }>> {
    return this.api.post(`/dev/simulate/${id}/fail?reason=${encodeURIComponent(reason)}`, {});
  }

  createLink(input: LinkInput, intent: string): Promise<Result<{ paymentLink: PaymentLink }>> {
    return this.api.post('/payment-links', input, { intent: `link:${intent}` });
  }

  forgetLink(intent: string): void {
    this.api.forget(`link:${intent}`);
  }

  cancelLink(id: string): Promise<Result<{ paymentLink: PaymentLink }>> {
    return this.api.post(`/payment-links/${id}/cancel`, {});
  }

  /** Simula um comprador pagando o link — cria uma tentativa contra a PixCharge. */
  payLink(
    id: string,
    customer: { document: string; name?: string },
  ): Promise<Result<{ payment: PaymentObject }>> {
    return this.api.post(`/payment-links/${id}/pay`, { customer });
  }

  failLink(id: string): Promise<Result<{ payment: PaymentObject }>> {
    return this.api.post(`/payment-links/${id}/fail`, {});
  }
}

export function chargeCommands(): ChargeCommands {
  return new ChargeCommands(inject(MerchantApi));
}

export type { PaymentObject };
