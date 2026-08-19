import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { toHttpParams } from '../http/list-query';
import type { PaymentObject } from './payment.service';

export type PaymentLinkStatus = 'ACTIVE' | 'OPENED' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export interface PaymentLinkRecord {
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
        storeId?: string;
        amount?: number;
        currency?: string;
        status: string;
        pixQrCode?: string;
        pixCopyPaste?: string;
        pixTxId: string;
        expiresAt: string | null;
        paidAt?: string | null;
        cancelledAt?: string | null;
        createdAt?: string;
        updatedAt?: string;
    };
    attempts?: PaymentObject[];
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
    items: PaymentLinkRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats: PaymentLinkStats;
}

export interface ListPaymentLinksQuery {
    page?: number;
    limit?: number;
    status?: PaymentLinkStatus;
    hasFailures?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PaymentLinkService {
    private readonly apiClient = inject(ApiClientService);

    private readonly linksState = signal<PaymentLinkRecord[]>([]);
    private readonly statsState = signal<PaymentLinkStats | null>(null);
    private readonly totalState = signal(0);
    private readonly pageState = signal(1);
    private readonly limitState = signal(20);
    private readonly totalPagesState = signal(1);
    private readonly isLoadingState = signal(false);
    private readonly errorState = signal<string | null>(null);

    readonly links = computed(() => this.linksState());
    readonly stats = computed(() => this.statsState());
    readonly total = computed(() => this.totalState());
    readonly page = computed(() => this.pageState());
    readonly limit = computed(() => this.limitState());
    readonly totalPages = computed(() => this.totalPagesState());
    readonly isLoading = computed(() => this.isLoadingState());
    readonly error = computed(() => this.errorState());

    load(query: ListPaymentLinksQuery = {}) {
        this.isLoadingState.set(true);
        this.errorState.set(null);

        const params = toHttpParams({
            page: query.page,
            limit: query.limit,
            status: query.status,
            hasFailures: query.hasFailures,
        });

        this.apiClient.get<ListPaymentLinksResponse>('/payment-links', { params })
            .pipe(finalize(() => this.isLoadingState.set(false)))
            .subscribe({
                next: response => {
                    this.linksState.set(response.items);
                    this.statsState.set(response.stats);
                    this.totalState.set(response.total);
                    this.pageState.set(response.page);
                    this.limitState.set(response.limit);
                    this.totalPagesState.set(Math.max(response.totalPages, 1));
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
        return this.apiClient.post<{ paymentLink: PaymentLinkRecord }>('/payment-links', input);
    }

    cancel(id: string) {
        return this.apiClient.post<{ paymentLink: PaymentLinkRecord }>(`/payment-links/${id}/cancel`, {});
    }

    get(id: string) {
        return this.apiClient.get<{ paymentLink: PaymentLinkRecord }>(`/payment-links/${id}`);
    }

    simulatePay(
        id: string,
        customer: { document: string; name?: string; email?: string },
    ) {
        return this.apiClient.post<{ payment: PaymentObject }>(`/payment-links/${id}/pay`, {
            customer,
        });
    }

    simulateFail(id: string) {
        return this.apiClient.post<{ payment: PaymentObject }>(`/payment-links/${id}/fail`, {});
    }
}
