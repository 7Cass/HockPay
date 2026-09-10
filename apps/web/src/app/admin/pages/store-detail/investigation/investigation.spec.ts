import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { OperatorInvestigation } from './investigation';

const API = 'http://localhost:3000/api/v1';
const STORE = `${API}/operator/stores/store-1`;

@Component({
  standalone: true,
  imports: [OperatorInvestigation],
  template: '<app-operator-investigation [storeId]="storeId()" />',
})
class Host {
  readonly storeId = signal('store-1');
}

describe('OperatorInvestigation', () => {
  let httpMock: HttpTestingController;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  async function open(url = '/operator/stores/store-1') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'operator/stores/store-1', component: Host }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, Host);

    el = harness.routeNativeElement as HTMLElement;
    await settle();
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function expectRead(path: string): TestRequest {
    return httpMock.expectOne((req) => req.url === `${STORE}${path}`);
  }

  async function flushPayments(payments: unknown[] = [], meta = {}) {
    expectRead('/payments').flush({
      payments,
      total: payments.length,
      page: 1,
      limit: 20,
      totalPages: 1,
      ...meta,
    });
    await settle();
  }

  function click(selector: string) {
    el.querySelector<HTMLButtonElement>(selector)!.click();
  }

  /** Aba por rótulo, para o teste não depender da ordem. */
  function tab(label: string): HTMLButtonElement {
    return Array.from(el.querySelectorAll<HTMLButtonElement>('.seg-tabs button')).find(
      (button) => button.textContent!.trim() === label,
    )!;
  }

  afterEach(() => httpMock.verify());

  it('reads payments with an explicit environment, never leaving it to a default', async () => {
    await open();

    const request = expectRead('/payments');
    expect(request.request.params.get('environment')).toBe('TEST');
    request.flush({ payments: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    await settle();

    expect(el.querySelector('[data-testid="env-note"]')?.textContent).toContain('TEST');
  });

  it('re-reads the same tab in the other environment when the desk switches', async () => {
    await open();
    await flushPayments();

    const [, live] = Array.from(el.querySelectorAll<HTMLButtonElement>('.seg-env button'));
    live.click();
    await settle();

    const request = expectRead('/payments');
    expect(request.request.params.get('environment')).toBe('LIVE');
    request.flush({ payments: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    await settle();

    expect(el.querySelector('[data-testid="env-note"]')?.textContent).toContain('LIVE');
  });

  it('reads the ledger and the statement together on the ledger tab', async () => {
    await open();
    await flushPayments();

    tab('Saldo e extrato').click();
    await settle();

    const account = expectRead('/account');
    const transactions = expectRead('/transactions');
    expect(account.request.params.get('environment')).toBe('TEST');
    expect(transactions.request.params.get('environment')).toBe('TEST');

    account.flush({
      account: {
        id: 'acc-1',
        storeId: 'store-1',
        environment: 'TEST',
        available: 25000,
        pending: 10000,
        blocked: 0,
        currency: 'BRL',
        updatedAt: '2026-09-07T10:00:00.000Z',
      },
    });
    transactions.flush({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });
    await settle();

    // Disponível + a liberar + bloqueado. O separador decimal é do locale do
    // runner, não da tela, então o teste olha o número e não a vírgula.
    const ledger = el.querySelector('[data-testid="ledger"]')!;
    expect(ledger.textContent).toMatch(/350[.,]00/);
    expect(ledger.textContent).toContain('Total no ledger TEST');
  });

  it('asks for webhooks without an environment, because they have none', async () => {
    await open();
    await flushPayments();

    tab('Webhooks').click();
    await settle();

    const configs = expectRead('/webhooks');
    const logs = expectRead('/webhooks/logs');
    expect(configs.request.params.has('environment')).toBe(false);
    expect(logs.request.params.has('environment')).toBe(false);

    configs.flush({ webhooks: [] });
    logs.flush({ logs: [], total: 0, page: 1, limit: 20 });
    await settle();
  });

  it('puts a sentence where the secret would be, not an empty field', async () => {
    await open();
    await flushPayments();

    tab('Webhooks').click();
    await settle();

    expectRead('/webhooks').flush({
      webhooks: [
        {
          id: 'hook-1',
          url: 'https://loja.example.com/hooks',
          prefix: 'whsec_abc123',
          events: ['payment.confirmed'],
          isActive: true,
          createdAt: '2026-08-01T12:00:00.000Z',
          updatedAt: '2026-08-01T12:00:00.000Z',
        },
      ],
    });
    expectRead('/webhooks/logs').flush({ logs: [], total: 0, page: 1, limit: 20 });
    await settle();

    const secret = el.querySelector('[data-testid="secret-field"]')!;
    expect(secret.textContent?.trim()).toBe('não visível para operador');
    expect(el.querySelector('[data-testid="secret-notice"]')?.textContent).toContain(
      'não é visível para operador',
    );
    expect(el.textContent).toContain('whsec_abc123');
  });

  it('opens a payment timeline in the environment being investigated', async () => {
    await open();
    await flushPayments([
      {
        id: 'pay-1',
        amount: 10000,
        fee: 165,
        netAmount: 9835,
        status: 'CONFIRMED',
        description: 'Camiseta',
        createdAt: '2026-09-05T12:00:00.000Z',
      },
    ]);

    click('tbody tr.is-clickable');
    await settle();

    const request = expectRead('/payments/pay-1/timeline');
    expect(request.request.params.get('environment')).toBe('TEST');
    request.flush({
      timeline: [
        {
          id: 'e1',
          type: 'payment.created',
          status: 'completed',
          title: 'Cobrança criada',
          occurredAt: '2026-09-05T12:00:00.000Z',
        },
      ],
    });
    await settle();

    expect(el.querySelector('adm-sheet adm-timeline .label')?.textContent?.trim()).toBe(
      'Cobrança criada',
    );
  });

  it('offers no route to API keys, because none exists', async () => {
    await open();
    await flushPayments();

    const labels = Array.from(el.querySelectorAll('.seg-tabs button')).map((b) =>
      b.textContent!.trim(),
    );

    expect(labels).toEqual(['Pagamentos', 'Saldo e extrato', 'Webhooks']);
    expect(el.textContent?.toLowerCase()).not.toContain('chave de api');
  });
});
