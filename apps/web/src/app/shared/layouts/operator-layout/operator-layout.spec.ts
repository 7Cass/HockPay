import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiClientService } from '../../../core/services/api-client.service';
import { AuthService } from '../../../core/services/auth.service';
import { OperatorAuthService } from '../../../core/services/operator-auth.service';
import { OperatorLayout } from './operator-layout';

describe('OperatorLayout', () => {
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

  // O toaster do shell consulta `prefers-reduced-motion`; jsdom não tem.
  beforeAll(() => {
    window.matchMedia ??= ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
  });

  async function render() {
    api = { get: vi.fn(), post: vi.fn() };

    TestBed.configureTestingModule({
      imports: [OperatorLayout],
      providers: [provideRouter([]), { provide: ApiClientService, useValue: api }],
    });

    const operatorAuth = TestBed.inject(OperatorAuthService);
    operatorAuth.isAuthenticated.set(true);
    operatorAuth.currentOperator.set({
      id: 'operator-1',
      name: 'Ana Mesa',
      email: 'ana@hockpay.dev',
    });

    const fixture = TestBed.createComponent(OperatorLayout);
    await fixture.whenStable();

    return {
      operatorAuth,
      el: fixture.nativeElement as HTMLElement,
      settle: async () => {
        await fixture.whenStable();
      },
    };
  }

  it('names who is at the desk, and marks the surface as the desk', async () => {
    const { el } = await render();

    expect(el.querySelector('.desk-who-name')?.textContent?.trim()).toBe('Ana Mesa');
    expect(el.querySelector('.desk-who-mail')?.textContent?.trim()).toBe('ana@hockpay.dev');
    expect(el.querySelector('.desk-avatar')?.textContent?.trim()).toBe('AM');
    expect(el.querySelector('.desk-tag')?.textContent?.trim()).toBe('mesa');
  });

  it('offers the desk destinations and nothing from the merchant dashboard', async () => {
    const { el } = await render();

    const hrefs = Array.from(el.querySelectorAll('.desk-nav-item')).map((a) =>
      a.getAttribute('href'),
    );

    expect(hrefs).toEqual(['/operator', '/operator/audit-logs']);
    expect(el.querySelector('a[href^="/dashboard"]')).toBeNull();
  });

  it('leaves through the operator endpoint and lands on the desk login', async () => {
    const { el } = await render();
    api.post.mockReturnValueOnce(of(undefined));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    el.querySelector<HTMLButtonElement>('.desk-exit')!.click();

    expect(api.post).toHaveBeenCalledWith('/operator/auth/logout', {});
    expect(navigate).toHaveBeenCalledWith(['/operator/login']);
  });

  it('keeps the merchant session untouched when the desk logs out', async () => {
    const { el } = await render();
    const merchant = TestBed.inject(AuthService);
    merchant.isAuthenticated.set(true);

    api.post.mockReturnValueOnce(of(undefined));
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    el.querySelector<HTMLButtonElement>('.desk-exit')!.click();

    expect(merchant.isAuthenticated()).toBe(true);
  });

  it('lets the operator try again when leaving fails', async () => {
    const { el, settle } = await render();
    api.post.mockReturnValueOnce(throwError(() => new Error('boom')));

    const exit = el.querySelector<HTMLButtonElement>('.desk-exit')!;
    exit.click();
    await settle();

    expect(exit.disabled).toBe(false);
  });
});
