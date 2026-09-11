import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OperatorWithdrawSheet } from './withdraw-sheet';
import type { OperatorWithdrawalResult } from '../../../services/operator-money.service';

const API = 'http://localhost:3000/api/v1';
const STORE = `${API}/operator/stores/store-1`;
const REASON = 'Chamado 4821: loja suspensa pede o saldo';

function destination(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bank-1',
    storeId: 'store-1',
    pixKey: 'financeiro@atelie.example',
    pixKeyType: 'EMAIL',
    holderName: 'Ateliê Corvo',
    holderDocument: '12345678000190',
    isDefault: true,
    isVerified: true,
    hasWithdrawals: false,
    hasActiveWithdrawals: false,
    withdrawalCount: 0,
    activeWithdrawalCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

@Component({
  standalone: true,
  imports: [OperatorWithdrawSheet],
  template: `
    <app-operator-withdraw-sheet
      storeId="store-1"
      storeName="Ateliê Corvo"
      [environment]="environment()"
      [available]="available()"
      (done)="done.set($event)"
      (closed)="closed.set(true)"
    />
  `,
})
class Host {
  readonly environment = signal<'TEST' | 'LIVE'>('LIVE');
  readonly available = signal(25000);
  readonly done = signal<OperatorWithdrawalResult | null>(null);
  readonly closed = signal(false);
}

describe('OperatorWithdrawSheet', () => {
  let fixture: ComponentFixture<Host>;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  async function open(destinations: unknown[] = [destination()]) {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Host);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    httpMock.expectOne(`${STORE}/bank-accounts`).flush({ bankAccounts: destinations });
    await settle();
  }

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function type(selector: string, value: string) {
    const control = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    control.value = value;
    control.dispatchEvent(new Event('input'));
    await settle();
  }

  function button(testId: string): HTMLButtonElement {
    return el.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
  }

  async function fillAndReview(amount = '50,00') {
    await type('#wd-amount', amount);
    await type('#wd-reason', REASON);
    button('withdraw-review').click();
    await settle();
  }

  async function confirm() {
    button('withdraw-confirm-button').click();
    await settle();
  }

  afterEach(() => httpMock.verify());

  it('starts on the default destination, and shows an unverified one without letting it be chosen', async () => {
    await open([
      destination(),
      destination({
        id: 'bank-2',
        isDefault: false,
        isVerified: false,
        pixKey: 'outra@atelie.example',
      }),
    ]);

    const select = el.querySelector<HTMLSelectElement>('#wd-destination')!;
    expect(select.value).toBe('bank-1');

    const unverified = Array.from(select.options).find((option) => option.value === 'bank-2')!;
    expect(unverified.disabled).toBe(true);
    expect(unverified.textContent).toContain('não verificado');
  });

  it('says the store has nowhere to receive, instead of showing an empty select', async () => {
    await open([destination({ isVerified: false })]);

    expect(el.querySelector('#wd-destination')).toBeNull();
    expect(el.querySelector('[data-testid="no-destination"]')?.textContent).toContain(
      'Nenhum destino Pix da loja está verificado',
    );
    expect(button('withdraw-review').disabled).toBe(true);
  });

  it('refuses a dot as decimal instead of withdrawing a hundred times more', async () => {
    await open();
    await type('#wd-amount', '10.50');
    await type('#wd-reason', REASON);

    expect(el.textContent).toContain('em reais, como 1.234,56');
    expect(button('withdraw-review').disabled).toBe(true);
  });

  it('refuses more than the available balance of the environment on screen', async () => {
    await open();
    await type('#wd-amount', '300,00');

    expect(el.textContent).toContain('maior que o disponível em LIVE');
  });

  it('asks for a reason before it lets the desk review', async () => {
    await open();
    await type('#wd-amount', '50,00');

    expect(button('withdraw-review').disabled).toBe(true);
  });

  it('confirms in prose, with the fee, the net and the environment on the button', async () => {
    await open();
    await fillAndReview('50,00');

    const summary = el.querySelector('[data-testid="withdraw-confirm"]')!;
    expect(summary.textContent).toContain('LIVE');
    expect(summary.textContent).toContain('financeiro@atelie.example');
    expect(summary.textContent).toContain(REASON);
    // Líquido 50,00 - 1,99, e o disponível que sobra. O separador decimal é do
    // locale do runner, então o teste olha o número e não a vírgula.
    expect(summary.textContent).toMatch(/48[.,]01/);
    expect(summary.textContent).toMatch(/200[.,]00/);
    expect(el.querySelector('[data-testid="live-warning"]')).not.toBeNull();

    const label = button('withdraw-confirm-button').textContent!;
    expect(label).toContain('em LIVE');
    expect(label).toMatch(/50[.,]00/);

    // Revisar não saca.
    httpMock.expectNone(`${STORE}/withdrawals`);
  });

  it('posts cents, the stated environment and the reason, and hands the result back', async () => {
    await open();
    await fillAndReview('50,00');
    await confirm();

    const request = httpMock.expectOne(`${STORE}/withdrawals`);
    expect(request.request.body).toEqual({
      bankAccountId: 'bank-1',
      amount: 5000,
      environment: 'LIVE',
      reason: REASON,
    });
    expect(request.request.headers.get('Idempotency-Key')).toBeTruthy();

    request.flush({ withdrawal: { id: 'wd-1', amount: 5000 }, account: { available: 20000 } });
    await settle();

    expect(fixture.componentInstance.done()?.withdrawal.id).toBe('wd-1');
  });

  it('keeps the key when a lost response is retried, and says retrying is safe', async () => {
    await open();
    await fillAndReview();
    await confirm();

    const first = httpMock.expectOne(`${STORE}/withdrawals`);
    const key = first.request.headers.get('Idempotency-Key');
    first.error(new ProgressEvent('error'));
    await settle();

    expect(el.querySelector('[data-testid="send-error"]')?.textContent).toContain(
      'Reenviar é seguro',
    );

    await confirm();
    const retry = httpMock.expectOne(`${STORE}/withdrawals`);
    expect(retry.request.headers.get('Idempotency-Key')).toBe(key);
    retry.flush({ withdrawal: { id: 'wd-1', amount: 5000 }, account: {} });
    await settle();
  });

  it('shows the reason the API gives when it refuses', async () => {
    await open();
    await fillAndReview();
    await confirm();

    httpMock
      .expectOne(`${STORE}/withdrawals`)
      .flush(
        { error: { code: 'INSUFFICIENT_WITHDRAWAL_BALANCE', message: 'Saldo insuficiente' } },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await settle();

    expect(el.querySelector('[data-testid="send-error"]')?.textContent).toContain(
      'Saldo insuficiente',
    );
    expect(fixture.componentInstance.done()).toBeNull();
  });
});
