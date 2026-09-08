import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { ApiClientService } from './api-client.service';
import { AuthService, CurrentUser } from './auth.service';
import { EnvironmentService } from './environment.service';
import { Store, StoreLiveStatus, StoreService } from './store.service';

describe('EnvironmentService', () => {
    const makeStore = (liveStatus: StoreLiveStatus): Store => ({
        id: 'store-a',
        name: 'Store A',
        slug: 'store-a',
        isActive: true,
        liveStatus,
        settlementDays: 2,
        feePercent: 2.99,
        feeFixed: 49,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const makeUser = (currentEnvironment?: 'TEST' | 'LIVE'): CurrentUser => ({
        id: 'merchant-1',
        name: 'Merchant',
        email: 'merchant@example.com',
        document: '52998224725',
        formattedDocument: '529.982.247-25',
        documentType: 'CPF',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        currentStoreId: 'store-a',
        currentEnvironment,
    });

    let api: { post: ReturnType<typeof vi.fn> };
    let user: ReturnType<typeof signal<CurrentUser | null>>;
    let currentStore: ReturnType<typeof signal<Store | null>>;
    let service: EnvironmentService;

    beforeEach(() => {
        api = { post: vi.fn() };
        user = signal<CurrentUser | null>(makeUser('TEST'));
        currentStore = signal<Store | null>(makeStore('NOT_REQUESTED'));

        TestBed.configureTestingModule({
            providers: [
                EnvironmentService,
                { provide: ApiClientService, useValue: api },
                { provide: AuthService, useValue: { currentUser: user } },
                { provide: StoreService, useValue: { currentStore } },
            ],
        });

        service = TestBed.inject(EnvironmentService);
    });

    it('reads the environment the server says the session is in', () => {
        user.set(makeUser('LIVE'));

        expect(service.current()).toBe('LIVE');
        expect(service.isLive()).toBe(true);
    });

    it('falls back to TEST when the server did not say', () => {
        // Mirrors the guard's own fallback: an unknown environment is TEST, not
        // an error and not a blank screen.
        user.set(makeUser(undefined));

        expect(service.current()).toBe('TEST');
    });

    it('opens LIVE only for an approved store', () => {
        currentStore.set(makeStore('APPROVED'));

        expect(service.canSelectLive()).toBe(true);
        expect(service.liveBlockedReason()).toBeNull();
    });

    it.each(['NOT_REQUESTED', 'PENDING', 'REJECTED', 'SUSPENDED'] as const)(
        'explains why LIVE is closed while the store is %s',
        (liveStatus) => {
            currentStore.set(makeStore(liveStatus));

            expect(service.canSelectLive()).toBe(false);
            // The reason is shown, not hidden: seeing the closed door is how the
            // merchant finds out it exists.
            expect(service.liveBlockedReason()).toBeTruthy();
        },
    );

    it('reloads the dashboard after switching, instead of filtering in place', async () => {
        api.post.mockReturnValueOnce(
            of({
                accessToken: 'a',
                refreshToken: 'r',
                expiresIn: 900,
                environment: 'LIVE',
            }),
        );
        const reload = vi
            .spyOn(service as never as { reloadDashboard: () => void }, 'reloadDashboard')
            .mockImplementation(() => undefined);

        await firstValueFrom(service.switchEnvironment('LIVE'));

        expect(api.post).toHaveBeenCalledWith('/auth/switch-environment', {
            environment: 'LIVE',
        });
        // Treating the switch as a client-side filter would leave one
        // environment's data on the other's screen for an instant.
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('releases the switching flag when the server refuses', async () => {
        api.post.mockReturnValueOnce(throwError(() => new Error('422')));

        await expect(firstValueFrom(service.switchEnvironment('LIVE'))).rejects.toThrow();

        expect(service.isSwitching()).toBe(false);
    });
});
