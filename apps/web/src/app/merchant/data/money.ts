import { httpResource } from '@angular/common/http';
import { Signal, inject } from '@angular/core';

import type { ListParams } from '../domain/list-params';
import { MerchantApi, type Result } from './api';

/* ── Saldo ────────────────────────────────────────────────────────────────── */

export interface Account {
  readonly id: string;
  readonly storeId: string;
  readonly available: number;
  readonly pending: number;
  readonly blocked: number;
  readonly currency: string;
  readonly updatedAt: string;
}

const EMPTY_ACCOUNT: Account = {
  id: '',
  storeId: '',
  available: 0,
  pending: 0,
  blocked: 0,
  currency: 'BRL',
  updatedAt: '',
};

/** O ledger do ambiente da sessão. Trocar de ambiente recarrega o console. */
export function accountResource() {
  const api = inject(MerchantApi);

  return httpResource<{ account: Account }>(() => api.request('/accounts/me'), {
    defaultValue: { account: EMPTY_ACCOUNT },
  });
}

/* ── Extrato ──────────────────────────────────────────────────────────────── */

export type TransactionKind =
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_RELEASED'
  | 'REFUND_DEDUCTED'
  | 'NEGATIVE_COMPENSATED'
  | 'WITHDRAWAL_RESERVED'
  | 'WITHDRAWAL_SENT'
  | 'WITHDRAWAL_REVERSED'
  | 'FEE_CHARGED'
  | 'ADJUSTMENT';

export interface LedgerEntry {
  readonly id: string;
  readonly type: TransactionKind | string;
  readonly amount: number;
  readonly fee: number;
  readonly netAmount: number;
  readonly balanceAfter: number;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly description?: string;
  readonly createdAt: string;
}

export interface LedgerPage {
  readonly data: readonly LedgerEntry[];
  readonly meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface LedgerQuery extends ListParams {
  readonly type: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly page: number;
  readonly limit: number;
}

export const LEDGER_QUERY: LedgerQuery = {
  type: '',
  startDate: '',
  endDate: '',
  page: 1,
  limit: 20,
};

export const EMPTY_LEDGER: LedgerPage = {
  data: [],
  meta: { page: 1, limit: LEDGER_QUERY.limit, total: 0, totalPages: 1 },
};

export function ledgerParams(query: LedgerQuery): Record<string, string | number> {
  return {
    page: query.page,
    limit: query.limit,
    ...(query.type ? { type: query.type } : {}),
    ...(query.startDate ? { startDate: query.startDate } : {}),
    ...(query.endDate ? { endDate: query.endDate } : {}),
  };
}

export function ledgerResource(query: Signal<LedgerQuery>) {
  const api = inject(MerchantApi);

  return httpResource<LedgerPage>(() => api.request('/transactions', ledgerParams(query())), {
    defaultValue: EMPTY_LEDGER,
  });
}

/** O vocabulário do extrato: o tipo técnico vira frase de dinheiro. */
export const LEDGER_LABELS: Readonly<Record<string, string>> = {
  PAYMENT_RECEIVED: 'Pagamento recebido',
  PAYMENT_RELEASED: 'Saldo liberado',
  REFUND_DEDUCTED: 'Estorno debitado',
  NEGATIVE_COMPENSATED: 'Compensação negativa',
  WITHDRAWAL_RESERVED: 'Saque reservado',
  WITHDRAWAL_SENT: 'Saque enviado',
  WITHDRAWAL_REVERSED: 'Saldo devolvido',
  FEE_CHARGED: 'Taxa',
  ADJUSTMENT: 'Ajuste',
};

export function ledgerLabel(type: string): string {
  return LEDGER_LABELS[type] ?? type;
}

/* ── Destinos Pix ─────────────────────────────────────────────────────────── */

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export interface PixDestination {
  readonly id: string;
  readonly pixKey: string;
  readonly pixKeyType: PixKeyType;
  readonly holderName: string;
  readonly holderDocument: string;
  readonly isDefault: boolean;
  readonly isVerified: boolean;
  readonly hasWithdrawals: boolean;
  readonly createdAt: string;
}

export function destinationsResource() {
  const api = inject(MerchantApi);

  return httpResource<readonly PixDestination[]>(() => api.request('/bank-accounts'), {
    defaultValue: [],
  });
}

/* ── Saques ───────────────────────────────────────────────────────────────── */

export type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Withdrawal {
  readonly id: string;
  readonly bankAccountId: string;
  readonly amount: number;
  readonly fee: number;
  readonly netAmount: number;
  readonly status: WithdrawalStatus;
  readonly pixE2eId?: string | null;
  readonly paidAt?: string | null;
  readonly failedReason?: string | null;
  readonly processingAttempts: number;
  readonly nextProcessAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WithdrawalSummary {
  readonly pendingCount: number;
  readonly processingCount: number;
  readonly completedCount: number;
  readonly pendingOrProcessingAmount: number;
  readonly completedNetAmount: number;
}

export interface WithdrawalPage {
  readonly withdrawals: readonly Withdrawal[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly summary: WithdrawalSummary;
}

export interface WithdrawalTimelineEvent {
  readonly type: string;
  readonly label: string;
  readonly occurredAt: string;
  readonly amount?: number;
  readonly transactionId?: string;
  readonly description?: string;
}

export interface WithdrawalDetail {
  readonly withdrawal: Withdrawal;
  readonly bankAccount?: PixDestination | null;
  readonly transactions?: readonly LedgerEntry[];
  readonly timeline?: readonly WithdrawalTimelineEvent[];
}

export interface WithdrawalQuery extends ListParams {
  readonly q: string;
  readonly status: string;
  readonly account: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly page: number;
  readonly limit: number;
}

export const WITHDRAWAL_QUERY: WithdrawalQuery = {
  q: '',
  status: '',
  account: '',
  startDate: '',
  endDate: '',
  page: 1,
  limit: 20,
};

export const EMPTY_SUMMARY: WithdrawalSummary = {
  pendingCount: 0,
  processingCount: 0,
  completedCount: 0,
  pendingOrProcessingAmount: 0,
  completedNetAmount: 0,
};

export const EMPTY_WITHDRAWALS: WithdrawalPage = {
  withdrawals: [],
  total: 0,
  page: 1,
  limit: WITHDRAWAL_QUERY.limit,
  totalPages: 1,
  summary: EMPTY_SUMMARY,
};

export function withdrawalsParams(query: WithdrawalQuery): Record<string, string | number> {
  return {
    page: query.page,
    limit: query.limit,
    ...(query.status ? { status: query.status } : {}),
    // A tela chama de "conta"; a API, de `bankAccountId`.
    ...(query.account ? { bankAccountId: query.account } : {}),
    ...(query.q.trim() ? { q: query.q.trim() } : {}),
    ...(query.startDate ? { startDate: query.startDate } : {}),
    ...(query.endDate ? { endDate: query.endDate } : {}),
  };
}

export function withdrawalsResource(query: Signal<WithdrawalQuery>) {
  const api = inject(MerchantApi);

  return httpResource<WithdrawalPage>(
    () => api.request('/withdrawals', withdrawalsParams(query())),
    { defaultValue: EMPTY_WITHDRAWALS },
  );
}

export function withdrawalResource(id: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<WithdrawalDetail | undefined>(() =>
    id() ? api.request(`/withdrawals/${id()}`) : undefined,
  );
}

/* ── Comandos ─────────────────────────────────────────────────────────────── */

/**
 * Os movimentos de dinheiro do lojista.
 *
 * A criação de saque leva `Idempotency-Key` presa à **intenção** — valor e
 * destino —, e não ao clique: resposta perdida reenviada não vira um segundo
 * saque, e corrigir o valor digitado gera intenção nova em vez de `409`.
 */
export class MoneyCommands {
  constructor(private readonly api: MerchantApi) {}

  createWithdrawal(input: {
    bankAccountId: string;
    amount: number;
  }): Promise<Result<WithdrawalDetail>> {
    return this.api.post<WithdrawalDetail>('/withdrawals', input, {
      intent: `withdrawal:${input.bankAccountId}:${input.amount}`,
    });
  }

  forgetWithdrawal(input: { bankAccountId: string; amount: number }): void {
    this.api.forget(`withdrawal:${input.bankAccountId}:${input.amount}`);
  }

  createDestination(input: {
    pixKey: string;
    pixKeyType: PixKeyType;
    holderName: string;
    holderDocument: string;
    isDefault?: boolean;
  }): Promise<Result<PixDestination>> {
    return this.api.post<PixDestination>('/bank-accounts', input);
  }

  setDefaultDestination(id: string): Promise<Result<void>> {
    return this.api.patch<void>(`/bank-accounts/${id}/default`, {});
  }

  removeDestination(id: string): Promise<Result<void>> {
    return this.api.delete<void>(`/bank-accounts/${id}`);
  }

  /** Simulação TEST: leva o saque ao desfecho sem esperar o worker. */
  completeWithdrawal(id: string): Promise<Result<WithdrawalDetail>> {
    return this.api.post<WithdrawalDetail>(`/dev/withdrawals/${id}/complete`, {});
  }

  failWithdrawal(
    id: string,
    reason = 'Falha simulada pelo console',
  ): Promise<Result<WithdrawalDetail>> {
    return this.api.post<WithdrawalDetail>(`/dev/withdrawals/${id}/fail`, { reason });
  }
}

export function moneyCommands(): MoneyCommands {
  return new MoneyCommands(inject(MerchantApi));
}
