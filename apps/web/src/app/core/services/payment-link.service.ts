import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { finalize } from 'rxjs';
import { ApiClientService } from './api-client.service';

export type PaymentLinkStatus = 'ACTIVE' | 'OPENED' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export interface PaymentLinkItem {
    id: string;
    storeId: string;
    pixChargeId: string;
    publicToken: string;
    amount: number;
    currency: string;
    title: string | null;
    description: string | null;
    internalReference: string | null;
    expiresAt: string | null;
    openedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
    checkoutUrl: string;
    status: PaymentLinkStatus;
    paymentId: string | null;
    paymentStatus: string | null;
    failedPaymentCount: number;
    lastPaymentId: string | null;
    lastPaymentStatus: string | null;
    lastFailedAt: string | null;
    pixCharge: {
        id: string;
        status: string;
        pixTxId: string;
        expiresAt: string;
    };
}

export interface PaymentLinkStats {
    total: number;
    active: number;
    opened: number;
    pending: number;
    paid: number;
    expired: number;
    cancelled: number;
    conversionRate: number;
    paidAmount: number;
}

export interface ListPaymentLinksResponse {
    items: PaymentLinkItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats: PaymentLinkStats;
}

@Injectable({ providedIn: 'root' })
export class PaymentLinkService {
    private readonly apiClient = inject(ApiClientService);

    private readonly linksState = signal<PaymentLinkItem[]>([]);
    private readonly statsState = signal<PaymentLinkStats | null>(null);
    private readonly isLoadingState = signal(false);
    private readonly errorState = signal<string | null>(null);

    readonly links = computed(() => this.linksState());
    readonly stats = computed(() => this.statsState());
    readonly isLoading = computed(() => this.isLoadingState());
    readonly error = computed(() => this.errorState());

    load(query: { page?: number; limit?: number; status?: PaymentLinkStatus } = {}) {
        this.isLoadingState.set(true);
        this.errorState.set(null);

        let params = new HttpParams();
        if (query.page) params = params.set('page', query.page);
        if (query.limit) params = params.set('limit', query.limit);
        if (query.status) params = params.set('status', query.status);

        this.apiClient.get<ListPaymentLinksResponse>('/payment-links', { params })
            .pipe(finalize(() => this.isLoadingState.set(false)))
            .subscribe({
                next: response => {
                    this.linksState.set(response.items);
                    this.statsState.set(response.stats);
                },
                error: err => this.errorState.set(err.message || 'Erro ao carregar links de pagamento'),
            });
    }

    create(input: {
        amount: number;
        title?: string;
        description?: string;
        internalReference?: string;
        expiresAt?: string;
    }) {
        return this.apiClient.post<{ paymentLink: PaymentLinkItem }>('/payment-links', input);
    }

    cancel(id: string) {
        return this.apiClient.post<{ paymentLink: PaymentLinkItem }>(`/payment-links/${id}/cancel`, {});
    }
}
