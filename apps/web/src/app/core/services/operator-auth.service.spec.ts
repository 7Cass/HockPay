import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { AuthService } from './auth.service';
import { CurrentOperator, OperatorAuthService } from './operator-auth.service';

describe('OperatorAuthService', () => {
  const operator: CurrentOperator = {
    id: 'operator-1',
    name: 'Ana Mesa',
    email: 'ana@hockpay.dev',
  };

  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  let service: OperatorAuthService;

  beforeEach(() => {
    api = { get: vi.fn(), post: vi.fn() };

    TestBed.configureTestingModule({
      providers: [OperatorAuthService, AuthService, { provide: ApiClientService, useValue: api }],
    });

    service = TestBed.inject(OperatorAuthService);
  });

  it('opens the desk session on its own endpoint and keeps the operator', async () => {
    api.post.mockReturnValueOnce(of({ expiresIn: 900, operator }));

    const result = await firstValueFrom(
      service.login({ email: 'ana@hockpay.dev', password: 'secret' }),
    );

    expect(api.post).toHaveBeenCalledWith('/operator/auth/login', {
      email: 'ana@hockpay.dev',
      password: 'secret',
    });
    expect(result.operator).toEqual(operator);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentOperator()).toEqual(operator);
  });

  it('verifies an unknown session against /operator/me, hydrating it', async () => {
    api.get.mockReturnValueOnce(of(operator));

    expect(service.isAuthenticated()).toBeNull();
    await expect(firstValueFrom(service.checkAuthStatus())).resolves.toBe(true);

    expect(api.get).toHaveBeenCalledWith('/operator/me');
    expect(service.currentOperator()).toEqual(operator);
  });

  it('answers a known session without asking the server again', async () => {
    api.get.mockReturnValueOnce(of(operator));
    await firstValueFrom(service.checkAuthStatus());

    await expect(firstValueFrom(service.checkAuthStatus())).resolves.toBe(true);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('reports no session instead of failing when /operator/me refuses', async () => {
    api.get.mockReturnValueOnce(throwError(() => new Error('401')));

    await expect(firstValueFrom(service.checkAuthStatus())).resolves.toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentOperator()).toBeNull();
  });

  it('shares one refresh across concurrent 401s', async () => {
    api.post.mockReturnValue(of({ expiresIn: 900 }));

    const first = service.handleTokenRefresh();
    const second = service.handleTokenRefresh();
    await Promise.all([firstValueFrom(first), firstValueFrom(second)]);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/operator/auth/refresh', {});
  });

  it('drops the desk session when the refresh fails, and nothing else', async () => {
    const merchant = TestBed.inject(AuthService);
    merchant.isAuthenticated.set(true);

    api.post.mockReturnValueOnce(throwError(() => new Error('401')));

    await expect(firstValueFrom(service.handleTokenRefresh())).rejects.toThrow();

    expect(service.isAuthenticated()).toBe(false);
    expect(merchant.isAuthenticated()).toBe(true);
  });

  it('logs out through the operator endpoint', async () => {
    api.post.mockReturnValueOnce(of({ expiresIn: 900, operator }));
    await firstValueFrom(service.login({ email: 'ana@hockpay.dev', password: 'secret' }));

    api.post.mockReturnValueOnce(of(undefined));
    await firstValueFrom(service.logout());

    expect(api.post).toHaveBeenLastCalledWith('/operator/auth/logout', {});
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentOperator()).toBeNull();
  });
});
