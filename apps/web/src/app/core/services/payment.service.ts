import { Injectable, computed, signal, inject } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { HttpParams } from '@angular/common/http';
import { finalize } from 'rxjs';

export enum PaymentStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    RELEASED = 'RELEASED',
    EXPIRED = 'EXPIRED',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
}

export interface PaymentObject {
    id: string;
    storeId: string;
    customerId: string;
    externalId?: string;
    amount: number;
    fee: number;
    netAmount: number;
    currency: string;
    description?: string;
    status: PaymentStatus;
    pixTxId?: string;
    checkoutUrl?: string;
    expiresAt: Date;
    paidAt?: Date;
    releasedAt?: Date;
    failedReason?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface ListPaymentsResponseDto {
    payments: PaymentObject[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ListPaymentsQueryDto {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
    customerId?: string;
    externalId?: string;
    startDate?: string;
    endDate?: string;
}

@Injectable({
    providedIn: 'root'
})
export class PaymentService {
    private apiClient = inject(ApiClientService);

    private paymentsState = signal<PaymentObject[]>([]);
    private totalState = signal<number>(0);
    private isLoadingState = signal<boolean>(false);
    private errorState = signal<string | null>(null);

    // Expose computed signals for components to consume
    readonly payments = computed(() => this.paymentsState());
    readonly total = computed(() => this.totalState());
    readonly isLoading = computed(() => this.isLoadingState());
    readonly error = computed(() => this.errorState());

    /**
     * Fetches paginated payments from the backend API.
     * Updates local signals on success or error.
     */
    loadPayments(query: ListPaymentsQueryDto = {}): void {
        this.isLoadingState.set(true);
        this.errorState.set(null);

        let params = new HttpParams();

        if (query.page) params = params.set('page', query.page.toString());
        if (query.limit) params = params.set('limit', query.limit.toString());
        if (query.status) params = params.set('status', query.status);
        if (query.customerId) params = params.set('customerId', query.customerId);
        if (query.externalId) params = params.set('externalId', query.externalId);
        if (query.startDate) params = params.set('startDate', query.startDate);
        if (query.endDate) params = params.set('endDate', query.endDate);

        this.apiClient.get<ListPaymentsResponseDto>('/payments', { params })
            .pipe(
                finalize(() => this.isLoadingState.set(false))
            )
            .subscribe({
                next: (response) => {
                    this.paymentsState.set(response.payments);
                    this.totalState.set(response.total);
                },
                error: (err) => {
                    console.error('Failed to load payments:', err);
                    this.errorState.set(err.message || 'Erro ao carregar os pagamentos');
                }
            });
    }
}
