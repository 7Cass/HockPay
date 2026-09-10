import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { AdminStore } from '../../services/operator-store.service';
import { OperatorStoreDetail } from './store-detail';

const API = 'http://localhost:3000/api/v1';

function store(overrides: Partial<AdminStore> = {}): AdminStore {
  return {
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Ateliê Corvo',
    slug: 'atelie-corvo',
    isActive: true,
    liveStatus: 'APPROVED',
    liveStatusReason: 'Documentos conferem.',
    liveStatusChangedAt: '2026-09-01T12:00:00.000Z',
    settlementDays: 30,
    feePercent: 1.5,
    feeFixed: 15,
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('OperatorStoreDetail', () => {
  let httpMock: HttpTestingController;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  async function open(overrides: Partial<AdminStore> = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'operator/stores/:id', component: OperatorStoreDetail }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/operator/stores/store-1', OperatorStoreDetail);

    const request = httpMock.expectOne(`${API}/operator/stores/store-1`);
    request.flush({ store: store(overrides) });

    el = harness.routeNativeElement as HTMLElement;
    await settle();

    // A investigação monta junto e já lê os pagamentos do ambiente TEST.
    httpMock
      .expectOne((req) => req.url === `${API}/operator/stores/store-1/payments`)
      .flush({ payments: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    await settle();

    return request;
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function field(id: string): HTMLInputElement {
    return el.querySelector<HTMLInputElement>(`#${id}`)!;
  }

  async function type(id: string, value: string) {
    const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  function saveButton(): HTMLButtonElement {
    return el.querySelector<HTMLButtonElement>('.terms-actions .adm-btn-primary')!;
  }

  afterEach(() => httpMock.verify());

  it('opens the store through the route that records the investigation', async () => {
    const request = await open();

    expect(request.request.method).toBe('GET');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Ateliê Corvo');
    expect(el.querySelector('[pageStatus]')?.textContent?.trim()).toBe('Aprovada');
  });

  it('starts the form on the condition the store has today', async () => {
    await open();

    expect(field('fee-percent').value).toBe('1.5');
    expect(field('fee-fixed').value).toBe('15');
    expect(field('settlement-days').value).toBe('30');
    expect(saveButton().disabled).toBe(true);
  });

  it('shows the before and the after only once something actually changed', async () => {
    await open();

    expect(el.querySelector('[data-testid="terms-diff"]')).toBeNull();

    await type('fee-percent', '2.9');

    const rows = Array.from(el.querySelectorAll('[data-testid="terms-diff"] tbody tr'));
    expect(rows.map((row) => row.classList.contains('is-changed'))).toEqual([true, false, false]);
    const [before, after] = Array.from(rows[0].querySelectorAll('td.adm-col-num')).map((td) =>
      td.textContent!.trim(),
    );
    expect([before, after]).toEqual(['1.5%', '2.9%']);
  });

  it('will not send a change without a reason', async () => {
    await open();
    await type('fee-percent', '2.9');

    expect(saveButton().disabled).toBe(true);

    await type('terms-reason', 'Renegociação anual.');

    expect(saveButton().disabled).toBe(false);
  });

  it('refuses a value outside the range the entity accepts, before asking the API', async () => {
    await open();
    await type('terms-reason', 'Renegociação anual.');

    await type('fee-percent', '150');
    expect(el.querySelector('.adm-field-error')?.textContent).toContain('fora da faixa');
    expect(saveButton().disabled).toBe(true);

    await type('fee-percent', '2.9');
    await type('settlement-days', '2.5');
    expect(saveButton().disabled).toBe(true);

    httpMock.expectNone(`${API}/operator/stores/store-1/commercial-terms`);
  });

  it('sends the three fields together, with the reason', async () => {
    await open();

    await type('fee-percent', '2.9');
    await type('fee-fixed', '39');
    await type('terms-reason', 'Renegociação anual.');

    saveButton().click();

    const request = httpMock.expectOne(`${API}/operator/stores/store-1/commercial-terms`);
    expect(request.request.body).toEqual({
      feePercent: 2.9,
      feeFixed: 39,
      settlementDays: 30,
      reason: 'Renegociação anual.',
    });

    request.flush({ store: store({ feePercent: 2.9, feeFixed: 39 }) });
    await settle();

    expect(el.querySelector('[data-testid="terms-diff"]')).toBeNull();
    expect(field('fee-percent').value).toBe('2.9');
    expect(el.querySelector<HTMLTextAreaElement>('#terms-reason')!.value).toBe('');
  });

  it('says out loud that shortening the settlement reaches payments already pending', async () => {
    await open();

    expect(el.querySelector('[data-testid="settlement-warning"]')).toBeNull();

    await type('settlement-days', '2');
    expect(el.querySelector('[data-testid="settlement-warning"]')?.textContent).toContain(
      'antecipa a liberação',
    );

    await type('settlement-days', '60');
    expect(el.querySelector('[data-testid="settlement-warning"]')).toBeNull();
  });

  it('puts the form back where it was when the change is discarded', async () => {
    await open();

    await type('fee-percent', '9');
    await type('terms-reason', 'Testando.');

    el.querySelector<HTMLButtonElement>('.terms-actions .adm-btn-quiet')!.click();
    await settle();

    expect(field('fee-percent').value).toBe('1.5');
    expect(el.querySelector<HTMLTextAreaElement>('#terms-reason')!.value).toBe('');
    expect(el.querySelector('[data-testid="terms-diff"]')).toBeNull();
  });
});
