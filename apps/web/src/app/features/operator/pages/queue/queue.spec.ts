import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { OperatorStoreListItem } from '../../../../core/services/operator-store.service';
import { OperatorQueue } from './queue';

const API = 'http://localhost:3000/api/v1';

function store(overrides: Partial<OperatorStoreListItem> = {}): OperatorStoreListItem {
  return {
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Ateliê Corvo',
    slug: 'atelie-corvo',
    liveStatus: 'PENDING',
    createdAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('OperatorQueue', () => {
  let httpMock: HttpTestingController;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  async function open(url = '/operator', data: OperatorStoreListItem[] = [store()]) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'operator', component: OperatorQueue }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, OperatorQueue);

    const request = httpMock.expectOne((req) => req.url === `${API}/operator/stores`);
    request.flush({ data, limit: 20, offset: Number(request.request.params.get('offset') ?? 0) });

    el = harness.routeNativeElement as HTMLElement;
    await settle();

    return request;
  }

  /** O painel de decisão vive num <dialog>, fora da tabela. */
  function sheet() {
    return el.querySelector('app-sheet');
  }

  function confirmButton() {
    return sheet()!.querySelector<HTMLButtonElement>(
      '.sheet-foot .btn-ink, .sheet-foot .btn-danger',
    )!;
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  afterEach(() => httpMock.verify());

  it('opens on what needs deciding, not on everything', async () => {
    const request = await open();

    expect(request.request.params.get('liveStatus')).toBe('PENDING');
    expect(el.querySelector('.seg button[aria-selected="true"]')?.textContent?.trim()).toBe(
      'Pendentes',
    );
  });

  it('asks the API for the state in the URL', async () => {
    const request = await open('/operator?liveStatus=APPROVED', []);

    expect(request.request.params.get('liveStatus')).toBe('APPROVED');
  });

  it('offers only the decisions the domain accepts from each state', async () => {
    await open('/operator?liveStatus=all', [
      store({ id: 's1', liveStatus: 'PENDING' }),
      store({ id: 's2', liveStatus: 'APPROVED' }),
      store({ id: 's3', liveStatus: 'SUSPENDED' }),
      store({ id: 's4', liveStatus: 'NOT_REQUESTED' }),
    ]);

    const rows = Array.from(el.querySelectorAll('tbody tr'));
    const actions = rows.map((row) =>
      Array.from(row.querySelectorAll('td.col-actions button')).map((b) => b.textContent!.trim()),
    );

    expect(actions).toEqual([['Aprovar', 'Rejeitar'], ['Suspender'], ['Aprovar'], []]);
    expect(rows[3].querySelector('td.col-actions')?.textContent).toContain('nada a decidir');
  });

  it('refuses to send a decision without a reason', async () => {
    await open();

    el.querySelector<HTMLButtonElement>('td.col-actions button')!.click();
    await settle();

    expect(sheet()!.querySelector('#decision-reason')).toBeTruthy();

    confirmButton().click();
    await settle();

    httpMock.expectNone((req) => req.url.includes('/live-status'));
  });

  it('sends the decision with its reason and shows the new state on the row', async () => {
    await open();

    el.querySelector<HTMLButtonElement>('td.col-actions button')!.click();
    await settle();

    const textarea = sheet()!.querySelector<HTMLTextAreaElement>('#decision-reason')!;
    textarea.value = 'Documentos conferem.';
    textarea.dispatchEvent(new Event('input'));
    await settle();

    confirmButton().click();

    const request = httpMock.expectOne(`${API}/operator/stores/store-1/live-status`);
    expect(request.request.body).toEqual({
      decision: 'approve',
      reason: 'Documentos conferem.',
    });

    request.flush({
      store: {
        id: 'store-1',
        liveStatus: 'APPROVED',
        liveStatusReason: 'Documentos conferem.',
        liveStatusChangedAt: '2026-09-07T10:00:00.000Z',
      },
    });
    await settle();

    expect(el.querySelector('tbody tr .chip')?.textContent?.trim()).toBe('Aprovada');
    expect(el.querySelector('tbody tr .reason')?.textContent?.trim()).toBe('Documentos conferem.');
    expect(el.querySelector('app-sheet')).toBeNull();
  });

  it('says the queue is empty rather than showing an empty table', async () => {
    await open('/operator', []);

    expect(el.querySelector('app-page-state')?.getAttribute('data-variant')).toBe('empty');
    expect(el.querySelector('app-page-state')?.textContent).toContain(
      'A fila vazia é o estado bom',
    );
    expect(el.querySelector('table')).toBeNull();
  });

  it('walks the queue by offset, because the API reports no total', async () => {
    await open(
      '/operator',
      Array.from({ length: 20 }, (_, i) => store({ id: `s${i}` })),
    );

    const [previous, next] = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.queue-foot-actions button'),
    );
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    await settle();

    expect(TestBed.inject(Router).url).toBe('/operator?offset=20');
    const request = httpMock.expectOne((req) => req.url === `${API}/operator/stores`);
    expect(request.request.params.get('offset')).toBe('20');
    request.flush({ data: [store()], limit: 20, offset: 20 });
    await settle();

    expect(el.querySelectorAll<HTMLButtonElement>('.queue-foot-actions button')[1].disabled).toBe(
      true,
    );
  });
});
