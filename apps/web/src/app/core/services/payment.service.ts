import { Injectable, computed, signal, inject } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { HttpParams } from '@angular/common/http';
import { finalize } from 'rxjs';
import type { ReceiptObject } from './receipt.service';

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
    customerId?: string;
    externalId?: string;
    paymentLinkId?: string;
    paymentOrigin?: string;
    attemptNumber?: number;
    attemptCount?: number;
    isLatestAttempt?: boolean;
    amount: number;
    fee: number;
    netAmount: number;
    currency: string;
    description?: string;
    payerName?: string;
    payerDocument?: string;
    payerEmail?: string;
    status: PaymentStatus;
    environment?: string;
    paymentMethod?: string;
    paymentDetails?: Record<string, any>;
    acquirerId?: string;
    totalRefunded?: number;
    items?: PaymentLineItem[];
    pixChargeId?: string;
    pixCharge?: {
        id: string;
        status: string;
        pixTxId: string;
        pixQrCode?: string;
        pixCopyPaste?: string;
        expiresAt?: Date | string | null;
    };
    checkoutUrl?: string;
    expiresAt: Date;
    paidAt?: Date;
    releasedAt?: Date;
    failedReason?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface PaymentLineItem {
    id?: string;
    productId?: string;
    productExternalId?: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl?: string;
    metadata?: Record<string, any>;
}

export interface CheckoutSessionObject {
    id: string;
    storeId: string;
    amount: number;
    currency: string;
    description?: string | null;
    customerCollectionMode: string;
    prefillCustomer?: Record<string, any> | null;
    paymentId?: string | null;
    checkoutToken: string;
    status: string;
    expiresAt: Date | string;
    successUrl?: string | null;
    cancelUrl?: string | null;
    metadata?: Record<string, any> | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface RefundObject {
    id: string;
    paymentId: string;
    amount: number;
    feeRefunded: number;
    reason?: string;
    status: string;
    processedAt?: Date | string;
    createdAt: Date | string;
}

export interface TransactionObject {
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
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface WebhookLogDto {
    id: string;
    configId: string;
    paymentId?: string;
    outboxEventId?: string;
    requestId?: string;
    deliveryId: string;
    eventType: string;
    payload: Record<string, any>;
    requestHeaders?: Record<string, string>;
    responseStatus?: number;
    responseBody?: string;
    attempt: number;
    maxAttempts: number;
    nextRetryAt?: Date | string;
    deliveredAt?: Date | string;
    createdAt: Date | string;
}

export type PaymentTimelineEventType =
    | 'payment.created'
    | 'checkout.completed'
    | 'payment.confirmed'
    | 'payment.expired'
    | 'payment.failed'
    | 'payment.released'
    | 'payment.refunded'
    | 'receipt.issued'
    | 'transaction.recorded'
    | 'webhook.delivered'
    | 'webhook.failed'
    | 'webhook.pending';

export interface PaymentTimelineEvent {
    id: string;
    type: PaymentTimelineEventType;
    status: 'completed' | 'pending' | 'failed' | 'neutral';
    title: string;
    description?: string;
    occurredAt: Date | string;
    entityId?: string;
    metadata?: Record<string, any>;
}

export interface GetPaymentTimelineResponseDto {
    payment: PaymentObject;
    relatedAttempts: PaymentObject[];
    checkoutSession?: CheckoutSessionObject | null;
    receipt?: ReceiptObject | null;
    refunds: RefundObject[];
    transactions: TransactionObject[];
    webhookLogs: WebhookLogDto[];
    timeline: PaymentTimelineEvent[];
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
    private pageState = signal<number>(1);
    private limitState = signal<number>(20);
    private totalPagesState = signal<number>(1);
    private isLoadingState = signal<boolean>(false);
    private errorState = signal<string | null>(null);
    private currentTimelineState = signal<GetPaymentTimelineResponseDto | null>(null);
    private isTimelineLoadingState = signal<boolean>(false);
    private timelineErrorState = signal<string | null>(null);

    // Expose computed signals for components to consume
    readonly payments = computed(() => this.paymentsState());
    readonly total = computed(() => this.totalState());
    readonly page = computed(() => this.pageState());
    readonly limit = computed(() => this.limitState());
    readonly totalPages = computed(() => this.totalPagesState());
    readonly isLoading = computed(() => this.isLoadingState());
    readonly error = computed(() => this.errorState());
    readonly currentTimeline = computed(() => this.currentTimelineState());
    readonly isTimelineLoading = computed(() => this.isTimelineLoadingState());
    readonly timelineError = computed(() => this.timelineErrorState());

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
                    this.pageState.set(response.page);
                    this.limitState.set(response.limit);
                    this.totalPagesState.set(Math.max(response.totalPages, 1));
                },
                error: (err) => {
                    console.error('Failed to load payments:', err);
                    this.errorState.set(err.message || 'Erro ao carregar os pagamentos');
                }
            });
    }

    getPaymentTimeline(paymentId: string) {
        return this.apiClient.get<GetPaymentTimelineResponseDto>(`/payments/${paymentId}/timeline`);
    }

    loadPaymentTimeline(paymentId: string): void {
        this.isTimelineLoadingState.set(true);
        this.timelineErrorState.set(null);
        this.currentTimelineState.set(null);

        this.getPaymentTimeline(paymentId)
            .pipe(finalize(() => this.isTimelineLoadingState.set(false)))
            .subscribe({
                next: (response) => {
                    this.currentTimelineState.set(response);
                },
                error: (err) => {
                    console.error('Failed to load payment timeline:', err);
                    this.timelineErrorState.set(err.message || 'Erro ao carregar o pagamento');
                }
            });
    }

    clearTimelineState(): void {
        this.currentTimelineState.set(null);
        this.timelineErrorState.set(null);
        this.isTimelineLoadingState.set(false);
    }
}
