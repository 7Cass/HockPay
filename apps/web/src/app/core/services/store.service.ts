import { inject, Injectable, signal } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { AuthService } from './auth.service';
import { map, Observable, switchMap, tap } from 'rxjs';

export interface Store {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    isApproved: boolean;
    settlementDays: number;
    feePercent: number;
    feeFixed: number;
    createdAt: string;
    updatedAt: string;
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
    private readonly authService = inject(AuthService);

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

                const selectedStore = this.currentStore();
                if (selectedStore) {
                    const refreshedStore = response.stores.find(s => s.id === selectedStore.id);
                    if (refreshedStore) {
                        this.currentStore.set(refreshedStore);
                        return;
                    }
                }

                // If a store is not yet selected in memory
                if (response.stores.length > 0) {
                    const savedStoreId = this.authService.currentUser()?.currentStoreId;

                    if (savedStoreId) {
                        // Select the store the user actually has saved in the DB
                        const savedStore = response.stores.find(s => s.id === savedStoreId);
                        this.currentStore.set(savedStore || response.stores[0]);
                    } else {
                        // Fallback to the first store if they don't have one saved
                        this.currentStore.set(response.stores[0]);
                    }
                } else {
                    this.currentStore.set(null);
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
            tap(() => this.redirectToDashboard())
        );
    }

    /**
     * Creates a new store for the authenticated merchant.
     * Auto-selects the new store after creation.
     */
    createStore(dto: CreateStoreDto): Observable<CreateStoreResponse> {
        return this.api.post<CreateStoreResponse>('/stores', dto).pipe(
            tap((response) => {
                this.stores.update((stores) => [
                    ...stores.filter((store) => store.id !== response.store.id),
                    response.store,
                ]);
                this.currentStore.set(response.store);
            }),
            switchMap((response) =>
                this.authService.hydrateCurrentUser().pipe(map(() => response))
            ),
            tap(() => this.redirectToDashboard())
        );
    }

    private redirectToDashboard(): void {
        // Hard reload to prevent memory leakage between tenants
        // and inject cleanly the new HttpOnly cookies into the new session.
        window.location.href = '/dashboard';
    }
}
