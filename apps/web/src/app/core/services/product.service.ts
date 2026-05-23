import { HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ApiClientService } from './api-client.service';

export interface ProductItem {
    id: string;
    storeId: string;
    externalId?: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
    environment: 'TEST' | 'LIVE';
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ListProductsResponse {
    products: ProductItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
    private readonly apiClient = inject(ApiClientService);

    private readonly productsState = signal<ProductItem[]>([]);
    private readonly totalState = signal(0);
    private readonly loadingState = signal(false);
    private readonly errorState = signal<string | null>(null);

    readonly products = computed(() => this.productsState());
    readonly total = computed(() => this.totalState());
    readonly isLoading = computed(() => this.loadingState());
    readonly error = computed(() => this.errorState());

    load(query: { page?: number; limit?: number; search?: string; isActive?: boolean } = {}) {
        this.loadingState.set(true);
        this.errorState.set(null);

        let params = new HttpParams();
        if (query.page) params = params.set('page', query.page);
        if (query.limit) params = params.set('limit', query.limit);
        if (query.search) params = params.set('search', query.search);
        if (query.isActive !== undefined) params = params.set('isActive', String(query.isActive));

        this.apiClient.get<ListProductsResponse>('/products', { params })
            .pipe(finalize(() => this.loadingState.set(false)))
            .subscribe({
                next: response => {
                    this.productsState.set(response.products);
                    this.totalState.set(response.total);
                },
                error: err => this.errorState.set(err.message || 'Erro ao carregar produtos'),
            });
    }

    create(input: {
        externalId?: string;
        name: string;
        description?: string;
        price: number;
        imageUrl?: string;
        metadata?: Record<string, unknown>;
    }) {
        return this.apiClient.post<{ product: ProductItem }>('/products', input);
    }

    update(id: string, input: Partial<{
        externalId: string | null;
        name: string;
        description: string | null;
        price: number;
        imageUrl: string | null;
        metadata: Record<string, unknown> | null;
        isActive: boolean;
    }>) {
        return this.apiClient.patch<{ product: ProductItem }>(`/products/${id}`, input);
    }
}
