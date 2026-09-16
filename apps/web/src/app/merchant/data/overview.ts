import { httpResource } from '@angular/common/http';
import { Signal, inject } from '@angular/core';

import type { ListParams } from '../domain/list-params';
import { type PeriodPreset, endOfDayIso, rangeFor, startOfDayIso } from '../domain/period';
import { MerchantApi } from './api';

/* ── O que a visão geral lê ──────────────────────────────────────────────── */

export interface OverviewChartPoint {
  readonly date: string;
  readonly netVolume: number;
  readonly salesCount: number;
}

export interface OverviewRecentPayment {
  readonly id: string;
  readonly amount: number;
  readonly netAmount: number;
  readonly currency: string;
  readonly status: string;
  readonly origin: 'api' | 'checkout' | 'payment_link' | 'unknown';
  readonly description?: string;
  readonly payerName?: string;
  readonly payerEmail?: string;
  readonly customerId?: string;
  readonly createdAt: string;
}

export interface Overview {
  readonly period: {
    readonly startDate: string;
    readonly endDate: string;
    readonly previousStartDate: string;
    readonly previousEndDate: string;
  };
  readonly balance: {
    readonly available: number;
    readonly pending: number;
    readonly blocked: number;
    readonly currency: string;
    readonly availableDelta: number | null;
    readonly pendingDelta: number | null;
  };
  readonly performance: {
    readonly grossVolume: number;
    readonly netVolume: number;
    readonly feeVolume: number;
    readonly salesCount: number;
    readonly averageTicket: number;
    readonly grossVolumeDelta: number | null;
    readonly netVolumeDelta: number | null;
    readonly salesCountDelta: number | null;
    readonly averageTicketDelta: number | null;
  };
  readonly conversion: {
    readonly paymentApprovalRate: number;
    readonly paymentAttempts: number;
    readonly approvedPayments: number;
    readonly linkConversionRate: number;
    readonly linksCreated: number;
    readonly linksOpened: number;
    readonly linksPaid: number;
  };
  readonly chart: readonly OverviewChartPoint[];
  readonly paymentStatusBreakdown: readonly { status: string; count: number; amount: number }[];
  readonly attention: {
    readonly pendingPayments: number;
    readonly failedPayments: number;
    readonly expiredPayments: number;
    readonly refundedPayments: number;
    readonly failedWebhookDeliveries: number;
    readonly pendingWebhookDeliveries: number;
    readonly failedAlertDeliveries: number;
    readonly pendingAlertDeliveries: number;
    readonly expiredLinks: number;
    readonly cancelledLinks: number;
  };
  readonly integrationsHealth: {
    readonly activeWebhooks: number;
    readonly activeAlerts: number;
    readonly failedWebhookDeliveries: number;
    readonly failedAlertDeliveries: number;
    readonly environment: 'TEST' | 'LIVE';
  };
  readonly recentPayments: readonly OverviewRecentPayment[];
}

/** O que a tela escolhe, e o que a URL guarda. */
export interface OverviewQuery extends ListParams {
  readonly preset: string;
  readonly startDate: string;
  readonly endDate: string;
}

export const OVERVIEW_QUERY: OverviewQuery = {
  preset: '30d',
  startDate: '',
  endDate: '',
};

/**
 * A visão geral vazia.
 *
 * Existe pelo mesmo motivo de `EMPTY_PAGE` em `data/payments`: enquanto carrega,
 * a tela lê zeros de verdade em vez de encher o template de `?.`. E como aqui
 * tudo é número de dinheiro, o zero também é o que se deve mostrar quando o
 * período não teve movimento.
 */
export const EMPTY_OVERVIEW: Overview = {
  period: { startDate: '', endDate: '', previousStartDate: '', previousEndDate: '' },
  balance: {
    available: 0,
    pending: 0,
    blocked: 0,
    currency: 'BRL',
    availableDelta: null,
    pendingDelta: null,
  },
  performance: {
    grossVolume: 0,
    netVolume: 0,
    feeVolume: 0,
    salesCount: 0,
    averageTicket: 0,
    grossVolumeDelta: null,
    netVolumeDelta: null,
    salesCountDelta: null,
    averageTicketDelta: null,
  },
  conversion: {
    paymentApprovalRate: 0,
    paymentAttempts: 0,
    approvedPayments: 0,
    linkConversionRate: 0,
    linksCreated: 0,
    linksOpened: 0,
    linksPaid: 0,
  },
  chart: [],
  paymentStatusBreakdown: [],
  attention: {
    pendingPayments: 0,
    failedPayments: 0,
    expiredPayments: 0,
    refundedPayments: 0,
    failedWebhookDeliveries: 0,
    pendingWebhookDeliveries: 0,
    failedAlertDeliveries: 0,
    pendingAlertDeliveries: 0,
    expiredLinks: 0,
    cancelledLinks: 0,
  },
  integrationsHealth: {
    activeWebhooks: 0,
    activeAlerts: 0,
    failedWebhookDeliveries: 0,
    failedAlertDeliveries: 0,
    environment: 'TEST',
  },
  recentPayments: [],
};

/**
 * O que a API recebe.
 *
 * A tela guarda `yyyy-mm-dd` — que é o que o `<input type="date">` fala e o que
 * cabe numa URL legível —, mas a API quer um instante. A conversão acontece
 * aqui, e os limites do dia vêm de `domain/period`, onde têm teste: o dia é o
 * do fuso do lojista, não o de UTC.
 */
export function overviewParams(query: OverviewQuery): Record<string, string> {
  const range = rangeFor(query.preset as PeriodPreset, {
    startDate: query.startDate,
    endDate: query.endDate,
  });

  return {
    startDate: startOfDayIso(range.startDate),
    endDate: endOfDayIso(range.endDate),
  };
}

export function overviewResource(query: Signal<OverviewQuery>) {
  const api = inject(MerchantApi);

  return httpResource<Overview>(() => api.request('/dashboard/overview', overviewParams(query())), {
    defaultValue: EMPTY_OVERVIEW,
  });
}
