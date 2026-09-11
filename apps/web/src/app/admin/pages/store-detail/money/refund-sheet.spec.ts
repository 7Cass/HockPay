import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OperatorRefundSheet } from './refund-sheet';
import { PaymentStatus, type PaymentObject } from '../../../domain/api-contracts';
import type { OperatorRefundResult } from '../../../services/operator-money.service';

const API = 'http://localhost:3000/api/v1';
const REFUNDS = `${API}/operator/stores/store-1/refunds`;
const REASON = 'Chamado 5102: pagador cobrado em duplicidade';

function payment(overrides: Partial<PaymentObject> = {}): PaymentObject {
  return {
    id: 'pay-1',
    storeId: 'store-1',
    amount: 10000,
    fee: 165,
    netAmount: 9835,
    currency: 'BRL',
    description: 'Camiseta',
    status: PaymentStatus.CONFIRMED,
    totalRefunded: 0,
    expiresAt: new Date('2026-09-06T12:00:00.000Z'),
    createdAt: new Date('2026-09-05T12:00:00.000Z'),
    updatedAt: new Date('2026-09-05T12:00:00.000Z'),
    ...overrides,
  };
}

@Component({
  standalone: true,
  imports: [OperatorRefundSheet],
  template: `
    <app-operator-refund-sheet
      storeId="store-1"
      storeName="Ateliê Corvo"
      [environment]="environment()"
      [payment]="payment()"
      (done)="done.set($event)"
      (closed)="closed.set(true)"
    />
  `,
})
class Host {
  readonly environment = signal<'TEST' | 'LIVE'>('TEST');
  readonly payment = signal(payment());
  readonly done = signal<OperatorRefundResult | null>(null);
  readonly closed = signal(false);
}

describe('OperatorRefundSheet', () => {
  let fixture: ComponentFixture<Host>;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  async function open(overrides: Partial<PaymentObject> = {}) {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.payment.set(payment(overrides));
    el = fixture.nativeElement as HTMLElement;
    await settle();
  }

  async function settle() {
    fixture.detectChanges();
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

  async function review(amount?: string) {
    if (amount !== undefined) await type('#rf-amount', amount);
    await type('#rf-reason', REASON);
    button('refund-review').click();
    await settle();
  }

  afterEach(() => httpMock.verify());

  it('starts on what is left to refund, not on the full amount', async () => {
    await open({ totalRefunded: 2500 });

    expect(el.querySelector<HTMLInputElement>('#rf-amount')!.value).toBe('75,00');
  });

  it('refuses more than is left to refund', async () => {
    await open({ totalRefunded: 2500 });
    await type('#rf-amount', '80,00');

    expect(el.textContent).toContain('maior que o estornável');
    expect(button('refund-review').disabled).toBe(true);
  });

  it('says a confirmed payment is refunded from what is still to be released', async () => {
    await open();
    await review('50,00');

    const summary = el.querySelector('[data-testid="refund-confirm"]')!;
    expect(summary.textContent).toContain('Sai do a liberar TEST');
    // Metade do pagamento devolve metade da taxa: 82,50 centavos, arredondados.
    expect(summary.textContent).toMatch(/0[.,]83/);
    expect(summary.textContent).toMatch(/49[.,]17/);
    expect(el.querySelector('[data-testid="full-refund"]')).toBeNull();
  });

  it('says a released payment is refunded from the available balance', async () => {
    await open({ status: PaymentStatus.RELEASED });
    await review();

    expect(el.querySelector('[data-testid="refund-confirm"]')?.textContent).toContain(
      'Sai do disponível TEST',
    );
    expect(el.querySelector('[data-testid="full-refund"]')).not.toBeNull();
  });

  it('posts the payment, cents, the environment as a check, and the reason', async () => {
    await open();
    await review('50,00');

    button('refund-confirm-button').click();
    await settle();

    const request = httpMock.expectOne(REFUNDS);
    expect(request.request.body).toEqual({
      paymentId: 'pay-1',
      amount: 5000,
      environment: 'TEST',
      reason: REASON,
    });
    expect(request.request.headers.get('Idempotency-Key')).toBeTruthy();

    request.flush({
      refund: { id: 'rf-1', amount: 5000 },
      payment: payment({ totalRefunded: 5000 }),
    });
    await settle();

    expect(fixture.componentInstance.done()?.refund.id).toBe('rf-1');
  });

  it('shows the reason the API gives when the ledgers disagree', async () => {
    await open();
    await review();

    button('refund-confirm-button').click();
    await settle();

    httpMock
      .expectOne(REFUNDS)
      .flush(
        { error: { code: 'LIVE_ENVIRONMENT_NOT_ALLOWED', message: 'Ambiente divergente' } },
        { status: 403, statusText: 'Forbidden' },
      );
    await settle();

    expect(el.querySelector('[data-testid="send-error"]')?.textContent).toContain(
      'Ambiente divergente',
    );
  });
});
