import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { finalize } from 'rxjs';
import { ApiClientService } from './api-client.service';

export enum ReceiptStatus {
    ISSUED = 'ISSUED',
    CANCELLED = 'CANCELLED',
}

export interface ReceiptObject {
    id: string;
    receiptNumber: string;
    paymentId: string;
    customerId?: string;
    storeId: string;
    payerName?: string;
    payerDocument?: string;
    payerEmail?: string;
    payeeName: string;
    payeeDocument?: string;
    amount: number;
    fee: number;
    netAmount: number;
    currency: string;
    description?: string;
    items?: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
    }>;
    status: ReceiptStatus;
    issuedAt: Date | string;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface ListReceiptsResponseDto {
    receipts: ReceiptObject[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface GetReceiptResponseDto {
    receipt: ReceiptObject;
}

export interface ListReceiptsQueryDto {
    page?: number;
    limit?: number;
    receiptNumber?: string;
    customerId?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ReceiptService {
    private readonly apiClient = inject(ApiClientService);

    private readonly receiptsState = signal<ReceiptObject[]>([]);
    private readonly totalState = signal<number>(0);
    private readonly pageState = signal<number>(1);
    private readonly limitState = signal<number>(20);
    private readonly totalPagesState = signal<number>(0);
    private readonly isLoadingState = signal<boolean>(false);
    private readonly errorState = signal<string | null>(null);

    private readonly currentReceiptState = signal<ReceiptObject | null>(null);
    private readonly isDetailLoadingState = signal<boolean>(false);
    private readonly detailErrorState = signal<string | null>(null);

    readonly receipts = computed(() => this.receiptsState());
    readonly total = computed(() => this.totalState());
    readonly page = computed(() => this.pageState());
    readonly limit = computed(() => this.limitState());
    readonly totalPages = computed(() => this.totalPagesState());
    readonly isLoading = computed(() => this.isLoadingState());
    readonly error = computed(() => this.errorState());

    readonly currentReceipt = computed(() => this.currentReceiptState());
    readonly isDetailLoading = computed(() => this.isDetailLoadingState());
    readonly detailError = computed(() => this.detailErrorState());

    loadReceipts(query: ListReceiptsQueryDto = {}): void {
        this.isLoadingState.set(true);
        this.errorState.set(null);

        let params = new HttpParams();

        if (query.page) params = params.set('page', query.page.toString());
        if (query.limit) params = params.set('limit', query.limit.toString());
        if (query.receiptNumber) params = params.set('receiptNumber', query.receiptNumber);
        if (query.customerId) params = params.set('customerId', query.customerId);

        this.apiClient.get<ListReceiptsResponseDto>('/receipts', { params })
            .pipe(finalize(() => this.isLoadingState.set(false)))
            .subscribe({
                next: (response) => {
                    this.receiptsState.set(response.receipts);
                    this.totalState.set(response.total);
                    this.pageState.set(response.page);
                    this.limitState.set(response.limit);
                    this.totalPagesState.set(response.totalPages);
                },
                error: (err) => {
                    console.error('Failed to load receipts:', err);
                    this.errorState.set(err.message || 'Erro ao carregar os comprovantes');
                    this.receiptsState.set([]);
                    this.totalState.set(0);
                    this.totalPagesState.set(0);
                }
            });
    }

    loadReceipt(receiptId: string): void {
        this.isDetailLoadingState.set(true);
        this.detailErrorState.set(null);
        this.currentReceiptState.set(null);

        this.apiClient.get<GetReceiptResponseDto>(`/receipts/${receiptId}`)
            .pipe(finalize(() => this.isDetailLoadingState.set(false)))
            .subscribe({
                next: (response) => {
                    this.currentReceiptState.set(response.receipt);
                },
                error: (err) => {
                    console.error('Failed to load receipt:', err);
                    this.detailErrorState.set(err.message || 'Erro ao carregar o comprovante');
                }
            });
    }

    loadReceiptByNumber(receiptNumber: string): void {
        this.isDetailLoadingState.set(true);
        this.detailErrorState.set(null);
        this.currentReceiptState.set(null);

        this.apiClient.get<GetReceiptResponseDto>(`/receipts/number/${receiptNumber}`)
            .pipe(finalize(() => this.isDetailLoadingState.set(false)))
            .subscribe({
                next: (response) => {
                    this.currentReceiptState.set(response.receipt);
                },
                error: (err) => {
                    console.error('Failed to load receipt by number:', err);
                    this.detailErrorState.set(err.message || 'Erro ao carregar o comprovante');
                }
            });
    }

    clearDetailState(): void {
        this.currentReceiptState.set(null);
        this.detailErrorState.set(null);
        this.isDetailLoadingState.set(false);
    }
}
