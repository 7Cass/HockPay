import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { ApiClientService } from '../services/api-client.service';
import { AuthService } from '../services/auth.service';
import { OperatorAuthService } from '../services/operator-auth.service';
import { operatorGuard, operatorGuestGuard } from './operator.guard';

describe('operator guards', () => {
  const operator = { id: 'operator-1', name: 'Ana Mesa', email: 'ana@hockpay.dev' };

  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  let operatorAuth: OperatorAuthService;
  let merchantAuth: AuthService;

  beforeEach(() => {
    api = { get: vi.fn(), post: vi.fn() };

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ApiClientService, useValue: api }],
    });

    operatorAuth = TestBed.inject(OperatorAuthService);
    merchantAuth = TestBed.inject(AuthService);
  });

  /** Guards are functions with an injection context; this is that context. */
  async function run(guard: typeof operatorGuard): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() => guard(null as never, null as never));
    return isObservable(result)
      ? ((await firstValueFrom(result)) as boolean | UrlTree)
      : (result as boolean | UrlTree);
  }

  function path(result: boolean | UrlTree): string {
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : String(result);
  }

  it('lets a known desk session through without touching the server', async () => {
    operatorAuth.isAuthenticated.set(true);
    operatorAuth.currentOperator.set(operator);

    await expect(run(operatorGuard)).resolves.toBe(true);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('sends a visitor with no desk session to the desk login', async () => {
    operatorAuth.isAuthenticated.set(false);

    expect(path(await run(operatorGuard))).toBe('/operator/login');
  });

  it('verifies an unknown session before deciding', async () => {
    api.get.mockReturnValueOnce(of(operator));

    await expect(run(operatorGuard)).resolves.toBe(true);
    expect(api.get).toHaveBeenCalledWith('/operator/me');
  });

  it('does not accept a merchant session as a desk session', async () => {
    merchantAuth.isAuthenticated.set(true);
    merchantAuth.currentUser.set({
      id: 'merchant-1',
      name: 'Loja',
      email: 'loja@example.com',
      document: '52998224725',
      formattedDocument: '529.982.247-25',
      documentType: 'CPF',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    api.get.mockReturnValueOnce(throwError(() => new Error('401')));

    expect(path(await run(operatorGuard))).toBe('/operator/login');
    expect(merchantAuth.isAuthenticated()).toBe(true);
  });

  it('keeps an open desk session out of the desk login', async () => {
    operatorAuth.isAuthenticated.set(true);

    expect(path(await run(operatorGuestGuard))).toBe('/operator');
  });

  it('lets a visitor with no desk session reach the desk login', async () => {
    operatorAuth.isAuthenticated.set(false);

    await expect(run(operatorGuestGuard)).resolves.toBe(true);
  });
});
