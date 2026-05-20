import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { AuthService, CurrentUser, LoginResponse } from './auth.service';

describe('AuthService', () => {
    const fullUser: CurrentUser = {
        id: 'merchant-1',
        name: 'Merchant',
        email: 'merchant@example.com',
        document: '52998224725',
        formattedDocument: '529.982.247-25',
        documentType: 'CPF',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        currentStoreId: 'store-1',
    };

    let api: {
        get: ReturnType<typeof vi.fn>;
        post: ReturnType<typeof vi.fn>;
    };
    let service: AuthService;

    beforeEach(() => {
        api = {
            get: vi.fn(),
            post: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                AuthService,
                { provide: ApiClientService, useValue: api },
            ],
        });

        service = TestBed.inject(AuthService);
    });

    it('hydrates the full merchant profile after login', async () => {
        const loginResponse: LoginResponse = {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 900,
            merchant: {
                id: 'merchant-1',
                name: 'Merchant',
                email: 'merchant@example.com',
                document: '52998224725',
                formattedDocument: '529.982.247-25',
                documentType: 'CPF',
            },
        };
        api.post.mockReturnValueOnce(of(loginResponse));
        api.get.mockReturnValueOnce(of(fullUser));

        const result = await firstValueFrom(
            service.login({ email: 'merchant@example.com', password: 'secret' }),
        );

        expect(result).toBe(loginResponse);
        expect(api.post).toHaveBeenCalledWith('/auth/login', {
            email: 'merchant@example.com',
            password: 'secret',
        });
        expect(api.get).toHaveBeenCalledWith('/merchants/me');
        expect(service.isAuthenticated()).toBe(true);
        expect(service.currentUser()).toEqual(fullUser);
    });

    it('hydrates when auth is true but current user is missing', async () => {
        service.isAuthenticated.set(true);
        service.currentUser.set(null);
        api.get.mockReturnValueOnce(of(fullUser));

        await expect(firstValueFrom(service.checkAuthStatus())).resolves.toBe(true);

        expect(api.get).toHaveBeenCalledWith('/merchants/me');
        expect(service.currentUser()).toEqual(fullUser);
    });

    it('shares refresh failures with every concurrent waiter', async () => {
        const error = new Error('refresh failed');
        const refresh = new Subject<unknown>();
        api.post.mockReturnValueOnce(refresh.asObservable());

        const first = firstValueFrom(service.handleTokenRefresh());
        const second = firstValueFrom(service.handleTokenRefresh());
        refresh.error(error);

        await expect(first).rejects.toBe(error);
        await expect(second).rejects.toBe(error);
        expect(api.post).toHaveBeenCalledTimes(1);
        expect(service.isAuthenticated()).toBe(false);
        expect(service.currentUser()).toBeNull();
    });
});
