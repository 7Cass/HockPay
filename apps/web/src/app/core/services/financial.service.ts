import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';

export interface AccountObject {
    id: string;
    storeId: string;
    available: number;
    pending: number;
    blocked: number;
    currency: string;
    updatedAt: Date | string;
}

export interface AccountResponseDto {
    account: AccountObject;
}

export type TransactionType =
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_RELEASED'
    | 'REFUND_DEDUCTED'
    | 'NEGATIVE_COMPENSATED'
    | 'WITHDRAWAL_SENT'
    | 'WITHDRAWAL_REVERSED'
    | 'FEE_CHARGED'
    | 'ADJUSTMENT';

export interface TransactionObject {
    id: string;
    accountId: string;
    type: TransactionType;
    amount: number;
    fee: number;
    netAmount: number;
    balanceAfter: number;
    referenceType?: string;
    referenceId?: string;
    description?: string;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface ListTransactionsResponse {
    data: TransactionObject[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface ListTransactionsFilters {
    page?: number;
    limit?: number;
    type?: TransactionType;
    startDate?: string;
    endDate?: string;
}

@Injectable({
    providedIn: 'root',
})
export class FinancialService {
    private readonly apiClient = inject(ApiClientService);

    getAccount(): Observable<AccountResponseDto> {
        return this.apiClient.get<AccountResponseDto>('/accounts/me');
    }

    listTransactions(filters: ListTransactionsFilters = {}): Observable<ListTransactionsResponse> {
        let params = new HttpParams();

        if (filters.page) params = params.set('page', String(filters.page));
        if (filters.limit) params = params.set('limit', String(filters.limit));
        if (filters.type) params = params.set('type', filters.type);
        if (filters.startDate) params = params.set('startDate', filters.startDate);
        if (filters.endDate) params = params.set('endDate', filters.endDate);

        return this.apiClient.get<ListTransactionsResponse>('/transactions', { params });
    }
}
