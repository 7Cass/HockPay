import { inject, Injectable, signal } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { Observable, tap } from 'rxjs';

export interface Store {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    isApproved: boolean;
    createdAt: string;
}

export interface ListStoresResponse {
    stores: Store[];
}

export interface SwitchStoreResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface CreateStoreDto {
    name: string;
    slug?: string;
}

export interface CreateStoreResponse {
    store: Store;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

@Injectable({
    providedIn: 'root'
})
export class StoreService {
    private readonly api = inject(ApiClientService);

    /** Reactive list of stores for the current merchant. */
    readonly stores = signal<Store[]>([]);

    /** Currently selected store. */
    readonly currentStore = signal<Store | null>(null);

    /**
     * Fetches all stores for the authenticated merchant.
     * Updates the internal stores signal.
     */
    loadStores(): Observable<ListStoresResponse> {
        return this.api.get<ListStoresResponse>('/stores').pipe(
            tap((response) => {
                this.stores.set(response.stores);
                // Auto-select the first store if none is selected
                if (!this.currentStore() && response.stores.length > 0) {
                    this.currentStore.set(response.stores[0]);
                }
            })
        );
    }

    /**
     * Switches the active store context via the API.
     * The backend will issue new tokens scoped to the selected store.
     */
    switchStore(storeId: string): Observable<SwitchStoreResponse> {
        return this.api.post<SwitchStoreResponse>(`/auth/switch-store/${storeId}`, {}).pipe(
            tap(() => {
                const store = this.stores().find(s => s.id === storeId);
                if (store) {
                    this.currentStore.set(store);
                }
            })
        );
    }

    /**
     * Creates a new store for the authenticated merchant.
     * Auto-selects the new store after creation.
     */
    createStore(dto: CreateStoreDto): Observable<CreateStoreResponse> {
        return this.api.post<CreateStoreResponse>('/stores', dto).pipe(
            tap((response) => {
                this.currentStore.set(response.store);
            })
        );
    }
}
