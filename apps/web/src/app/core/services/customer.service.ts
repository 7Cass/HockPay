import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { finalize } from 'rxjs';
import { ApiClientService } from './api-client.service';

export interface CustomerObject {
    id: string;
    storeId: string;
    externalId?: string;
    name?: string;
    email?: string;
    document: string;
    formattedDocument: string;
    documentType: 'CPF' | 'CNPJ';
    phone?: string;
    street?: string;
    number?: string;
    complement?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface ListCustomersResponseDto {
    customers: CustomerObject[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface GetCustomerResponseDto {
    customer: CustomerObject;
}

export interface ListCustomersQueryDto {
    page?: number;
    limit?: number;
    search?: string;
}

@Injectable({
    providedIn: 'root',
})
export class CustomerService {
    private readonly apiClient = inject(ApiClientService);

    private readonly customersState = signal<CustomerObject[]>([]);
    private readonly totalState = signal(0);
    private readonly pageState = signal(1);
    private readonly limitState = signal(20);
    private readonly totalPagesState = signal(0);
    private readonly isLoadingState = signal(false);
    private readonly errorState = signal<string | null>(null);

    private readonly currentCustomerState = signal<CustomerObject | null>(null);
    private readonly isDetailLoadingState = signal(false);
    private readonly detailErrorState = signal<string | null>(null);

    readonly customers = computed(() => this.customersState());
    readonly total = computed(() => this.totalState());
    readonly page = computed(() => this.pageState());
    readonly limit = computed(() => this.limitState());
    readonly totalPages = computed(() => this.totalPagesState());
    readonly isLoading = computed(() => this.isLoadingState());
    readonly error = computed(() => this.errorState());

    readonly currentCustomer = computed(() => this.currentCustomerState());
    readonly isDetailLoading = computed(() => this.isDetailLoadingState());
    readonly detailError = computed(() => this.detailErrorState());

    loadCustomers(query: ListCustomersQueryDto = {}): void {
        this.isLoadingState.set(true);
        this.errorState.set(null);

        let params = new HttpParams();
        if (query.page) params = params.set('page', query.page.toString());
        if (query.limit) params = params.set('limit', query.limit.toString());
        if (query.search) params = params.set('search', query.search);

        this.apiClient.get<ListCustomersResponseDto>('/customers', { params })
            .pipe(finalize(() => this.isLoadingState.set(false)))
            .subscribe({
                next: (response) => {
                    this.customersState.set(response.customers);
                    this.totalState.set(response.total);
                    this.pageState.set(response.page);
                    this.limitState.set(response.limit);
                    this.totalPagesState.set(response.totalPages);
                },
                error: (err) => {
                    console.error('Failed to load customers:', err);
                    this.errorState.set(err.message || 'Erro ao carregar clientes');
                    this.customersState.set([]);
                    this.totalState.set(0);
                    this.totalPagesState.set(0);
                },
            });
    }

    loadCustomer(customerId: string): void {
        this.isDetailLoadingState.set(true);
        this.detailErrorState.set(null);
        this.currentCustomerState.set(null);

        this.apiClient.get<GetCustomerResponseDto>(`/customers/id/${customerId}`)
            .pipe(finalize(() => this.isDetailLoadingState.set(false)))
            .subscribe({
                next: (response) => {
                    this.currentCustomerState.set(response.customer);
                },
                error: (err) => {
                    console.error('Failed to load customer:', err);
                    this.detailErrorState.set(err.message || 'Erro ao carregar cliente');
                },
            });
    }

    clearDetailState(): void {
        this.currentCustomerState.set(null);
        this.detailErrorState.set(null);
        this.isDetailLoadingState.set(false);
    }
}
