import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { AuthService, CurrentUser } from './auth.service';
import { CreateStoreResponse, Store, StoreService } from './store.service';

describe('StoreService', () => {
    const storeA: Store = {
        id: 'store-a',
        name: 'Store A',
        slug: 'store-a',
        isActive: true,
        isApproved: true,
        settlementDays: 2,
        feePercent: 2.99,
        feeFixed: 49,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const storeB: Store = {
        ...storeA,
        id: 'store-b',
        name: 'Store B',
        slug: 'store-b',
    };
    const user = signal<CurrentUser | null>({
        id: 'merchant-1',
        name: 'Merchant',
        email: 'merchant@example.com',
        document: '52998224725',
        formattedDocument: '529.982.247-25',
        documentType: 'CPF',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        currentStoreId: 'store-b',
    });

    let api: {
        get: ReturnType<typeof vi.fn>;
        post: ReturnType<typeof vi.fn>;
    };
    let authService: {
        currentUser: typeof user;
        hydrateCurrentUser: ReturnType<typeof vi.fn>;
    };
    let service: StoreService;

    beforeEach(() => {
        api = {
            get: vi.fn(),
            post: vi.fn(),
        };
        authService = {
            currentUser: user,
            hydrateCurrentUser: vi.fn(() => of(user())),
        };

        TestBed.configureTestingModule({
            providers: [
                StoreService,
                { provide: ApiClientService, useValue: api },
                { provide: AuthService, useValue: authService },
            ],
        });

        service = TestBed.inject(StoreService);
    });

    it('selects the store saved in the hydrated user profile', async () => {
        api.get.mockReturnValueOnce(of({ stores: [storeA, storeB] }));

        await firstValueFrom(service.loadStores());

        expect(service.currentStore()).toEqual(storeB);
    });

    it('hydrates auth and redirects after creating a store', async () => {
        const response: CreateStoreResponse = {
            store: storeB,
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 900,
        };
        api.post.mockReturnValueOnce(of(response));
        const redirect = vi
            .spyOn(service as any, 'redirectToDashboard')
            .mockImplementation(() => undefined);

        const result = await firstValueFrom(
            service.createStore({ name: 'Store B', slug: 'store-b' }),
        );

        expect(result).toBe(response);
        expect(service.currentStore()).toEqual(storeB);
        expect(service.stores()).toEqual([storeB]);
        expect(authService.hydrateCurrentUser).toHaveBeenCalledTimes(1);
        expect(redirect).toHaveBeenCalledTimes(1);
    });
});
