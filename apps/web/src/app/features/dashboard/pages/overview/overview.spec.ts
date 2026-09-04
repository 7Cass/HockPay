import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  DashboardOverviewResponse,
  DashboardService,
} from '../../../../core/services/dashboard.service';
import { StoreService } from '../../../../core/services/store.service';
import { Overview } from './overview';

describe('Overview', () => {
  function createComponent(overview?: Partial<DashboardOverviewResponse>) {
    const dashboardService = {
      getOverview: vi.fn(() => of(overview as DashboardOverviewResponse)),
    };
    const storeService = { currentStore: signal(null) };

    TestBed.configureTestingModule({
      providers: [
        { provide: DashboardService, useValue: dashboardService },
        { provide: StoreService, useValue: storeService },
      ],
    });

    return {
      component: TestBed.runInInjectionContext(() => new Overview()),
      dashboardService,
    };
  }

  it('tones a delta only when it actually moved', () => {
    const { component } = createComponent();

    expect(component.deltaTone(0.12)).toBe('ok');
    expect(component.deltaTone(-0.04)).toBe('bad');
    expect(component.deltaTone(0)).toBeNull();
    expect(component.deltaTone(null)).toBeNull();

    expect(component.deltaIcon(-0.04)).toBe('lucideTrendingDown');
    expect(component.deltaIcon(0.12)).toBe('lucideTrendingUp');
    expect(component.deltaIcon(null)).toBe('lucideTrendingUp');
  });

  it('switches to the custom filter when either date field changes', () => {
    const { component } = createComponent();

    expect(component.activeFilter()).toBe('30days');

    component.setCustomStart('2026-08-01');
    component.setCustomEnd('2026-08-20');

    expect(component.activeFilter()).toBe('custom');
    expect(component.selectedRange()).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-20',
    });
  });

  it('drops empty status segments and sizes the rest against total attempts', () => {
    const { component } = createComponent();

    component.overview.set({
      conversion: { paymentAttempts: 10, approvedPayments: 7 },
      paymentStatusBreakdown: [
        { status: 'FAILED', count: 2, amount: 0 },
        { status: 'EXPIRED', count: 0, amount: 0 },
        { status: 'REFUNDED', count: 1, amount: 0 },
      ],
    } as DashboardOverviewResponse);

    expect(component.paymentStatusSegments()).toEqual([
      { label: 'Aprovadas', value: 7, tone: 'ok', percent: 70 },
      { label: 'Falhas', value: 2, tone: 'bad', percent: 20 },
      { label: 'Estornadas', value: 1, tone: 'neutral', percent: 10 },
    ]);
  });

  it('reports an empty period only when nothing moved at all', () => {
    const { component } = createComponent();

    component.overview.set({
      performance: { salesCount: 0, netVolume: 0 },
      chart: [{ date: '2026-08-01', netVolume: 0, salesCount: 0 }],
    } as DashboardOverviewResponse);
    expect(component.isEmptyPeriod()).toBe(true);

    component.overview.set({
      performance: { salesCount: 0, netVolume: 0 },
      chart: [{ date: '2026-08-01', netVolume: 4200, salesCount: 1 }],
    } as DashboardOverviewResponse);
    expect(component.isEmptyPeriod()).toBe(false);
  });
});
