import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ApiClientService } from '../../../../../core/services/api-client.service';
import { AuthService, CurrentUser } from '../../../../../core/services/auth.service';
import { EnvironmentService } from '../../../../../core/services/environment.service';
import { Store, StoreLiveStatus, StoreService } from '../../../../../core/services/store.service';
import { EnvironmentSelector } from './environment-selector';

describe('EnvironmentSelector', () => {
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

  const makeUser = (currentEnvironment: 'TEST' | 'LIVE'): CurrentUser => ({
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

  async function render(options: {
    environment: 'TEST' | 'LIVE';
    liveStatus: StoreLiveStatus;
  }) {
    const api = { post: vi.fn().mockReturnValue(of({ environment: 'LIVE' })) };

    TestBed.configureTestingModule({
      imports: [EnvironmentSelector],
      providers: [
        provideRouter([]),
        { provide: ApiClientService, useValue: api },
        {
          provide: AuthService,
          useValue: { currentUser: signal<CurrentUser | null>(makeUser(options.environment)) },
        },
        {
          provide: StoreService,
          useValue: { currentStore: signal<Store | null>(makeStore(options.liveStatus)) },
        },
      ],
    });

    const environments = TestBed.inject(EnvironmentService);
    vi.spyOn(
      environments as never as { reloadDashboard: () => void },
      'reloadDashboard',
    ).mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(EnvironmentSelector);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;

    return {
      api,
      el,
      open: async () => {
        el.querySelector<HTMLButtonElement>('.env-trigger')!.click();
        await fixture.whenStable();
      },
      rowFor: (label: string) =>
        [...el.querySelectorAll<HTMLButtonElement>('.menu-row')].find((row) =>
          row.textContent?.includes(label),
        ),
      settle: async () => {
        await fixture.whenStable();
      },
    };
  }

  it('shows the environment the session is actually in', async () => {
    const view = await render({ environment: 'LIVE', liveStatus: 'APPROVED' });

    expect(view.el.querySelector('.env')?.textContent?.trim()).toBe('LIVE');
  });

  it('never shows LIVE without saying it is simulated', async () => {
    const view = await render({ environment: 'LIVE', liveStatus: 'APPROVED' });
    await view.open();

    // No gatilho e na opção. Um selo "LIVE" idêntico ao de um gateway real
    // seria a mentira mais cara que o simulador consegue contar.
    expect(view.el.querySelector('.env-sim')?.textContent).toContain('simulado');
    expect(view.rowFor('LIVE')?.textContent).toContain('simulado');
  });

  it('offers LIVE for an approved store, and switches through the API', async () => {
    const view = await render({ environment: 'TEST', liveStatus: 'APPROVED' });
    await view.open();

    const live = view.rowFor('LIVE')!;
    expect(live.disabled).toBe(false);

    live.click();
    await view.settle();

    expect(view.api.post).toHaveBeenCalledWith('/auth/switch-environment', {
      environment: 'LIVE',
    });
  });

  it.each(['NOT_REQUESTED', 'PENDING', 'REJECTED', 'SUSPENDED'] as const)(
    'shows LIVE closed, with the reason and a way to Settings, while %s',
    async (liveStatus) => {
      const view = await render({ environment: 'TEST', liveStatus });
      await view.open();

      const live = view.rowFor('LIVE')!;
      expect(live.disabled).toBe(true);

      // Fechada, não escondida: ver a porta é como o lojista descobre que ela
      // existe, e o caminho para abri-la está ali do lado.
      expect(view.el.querySelector('.menu-note')?.textContent?.trim()).toBeTruthy();
      expect(view.el.querySelector('a[href="/dashboard/settings"]')).not.toBeNull();

      live.click();
      await view.settle();

      expect(view.api.post).not.toHaveBeenCalled();
    },
  );

  it('never closes TEST, even when the desk suspended the store', async () => {
    const view = await render({ environment: 'LIVE', liveStatus: 'SUSPENDED' });
    await view.open();

    const test = view.rowFor('TEST')!;
    expect(test.disabled).toBe(false);

    test.click();
    await view.settle();

    expect(view.api.post).toHaveBeenCalledWith('/auth/switch-environment', {
      environment: 'TEST',
    });
  });
});
