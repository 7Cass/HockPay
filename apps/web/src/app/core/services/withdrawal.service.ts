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

export interface ListWithdrawalsFilters {
    page?: number;
    limit?: number;
    status?: WithdrawalStatus;
    bankAccountId?: string;
    startDate?: string;
    endDate?: string;
}

export interface ListWithdrawalsResponse {
    withdrawals: Withdrawal[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface WithdrawalResponse {
    withdrawal: Withdrawal;
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
