import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';

export type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Withdrawal {
    id: string;
    accountId: string;
    bankAccountId: string;
    amount: number;
    fee: number;
    netAmount: number;
    status: WithdrawalStatus;
    pixE2eId?: string | null;
    paidAt?: string | null;
    failedReason?: string | null;
    processingAttempts: number;
    nextProcessAt?: string | null;
    lastProcessingError?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface WithdrawalSummary {
    totalCount: number;
    totalAmount: number;
    totalFee: number;
    totalNetAmount: number;
    pendingCount: number;
    processingCount: number;
    completedCount: number;
    failedCount: number;
    pendingOrProcessingAmount: number;
    completedNetAmount: number;
    failedAmount: number;
}

export interface WithdrawalTimelineEvent {
    type: 'CREATED' | 'RESERVED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'REVERSED' | 'RETRY_SCHEDULED';
    label: string;
    occurredAt: string;
    amount?: number;
    transactionId?: string;
    description?: string;
}

export interface WithdrawalTransaction {
    id: string;
    accountId: string;
    type: string;
    amount: number;
    fee: number;
    netAmount: number;
    balanceAfter: number;
    referenceType?: string;
    referenceId?: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ListWithdrawalsFilters {
    page?: number;
    limit?: number;
    status?: WithdrawalStatus;
    bankAccountId?: string;
    startDate?: string;
    endDate?: string;
    q?: string;
}

export interface ListWithdrawalsResponse {
    withdrawals: Withdrawal[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary: WithdrawalSummary;
}

export interface WithdrawalResponse {
    withdrawal: Withdrawal;
    bankAccount?: import('./bank-account.service').BankAccount | null;
    transactions?: WithdrawalTransaction[];
    timeline?: WithdrawalTimelineEvent[];
}

export interface CreateWithdrawalInput {
    bankAccountId: string;
    amount: number;
}

@Injectable({
    providedIn: 'root',
})
export class WithdrawalService {
    private readonly apiClient = inject(ApiClientService);

    list(filters: ListWithdrawalsFilters = {}): Observable<ListWithdrawalsResponse> {
        let params = new HttpParams();

        if (filters.page) params = params.set('page', String(filters.page));
        if (filters.limit) params = params.set('limit', String(filters.limit));
        if (filters.status) params = params.set('status', filters.status);
        if (filters.bankAccountId) params = params.set('bankAccountId', filters.bankAccountId);
        if (filters.startDate) params = params.set('startDate', filters.startDate);
        if (filters.endDate) params = params.set('endDate', filters.endDate);
        if (filters.q) params = params.set('q', filters.q);

        return this.apiClient.get<ListWithdrawalsResponse>('/withdrawals', { params });
    }

    get(id: string): Observable<WithdrawalResponse> {
        return this.apiClient.get<WithdrawalResponse>(`/withdrawals/${id}`);
    }

    create(input: CreateWithdrawalInput): Observable<WithdrawalResponse> {
        const headers = new HttpHeaders({
            'Idempotency-Key': crypto.randomUUID(),
        });

        return this.apiClient.post<WithdrawalResponse>('/withdrawals', input, { headers });
    }

    completeDev(id: string): Observable<WithdrawalResponse> {
        return this.apiClient.post<WithdrawalResponse>(`/dev/withdrawals/${id}/complete`, {});
    }

    failDev(id: string, reason = 'Falha simulada pelo dashboard TEST'): Observable<WithdrawalResponse> {
        return this.apiClient.post<WithdrawalResponse>(`/dev/withdrawals/${id}/fail`, { reason });
    }
}
