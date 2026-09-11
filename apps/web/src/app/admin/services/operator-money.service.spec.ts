import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OperatorMoneyService, type OperatorWithdrawalInput } from './operator-money.service';

const API = 'http://localhost:3000/api/v1';
const WITHDRAWALS = `${API}/operator/stores/store-1/withdrawals`;
const REFUNDS = `${API}/operator/stores/store-1/refunds`;

const WITHDRAWAL: OperatorWithdrawalInput = {
  bankAccountId: 'bank-1',
  amount: 5000,
  environment: 'LIVE',
  reason: 'Chamado 4821: loja suspensa pede o saldo',
};

describe('OperatorMoneyService', () => {
  let service: OperatorMoneyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OperatorMoneyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** Dispara o saque e devolve a chave que foi no header. */
  function withdrawAndTakeKey(input = WITHDRAWAL, outcome: 'ok' | 'fail' = 'fail'): string {
    service.withdraw('store-1', input).subscribe({ error: () => undefined });
    const request = httpMock.expectOne(WITHDRAWALS);
    const key = request.request.headers.get('Idempotency-Key')!;

    if (outcome === 'ok') {
      request.flush(
        { withdrawal: { id: 'wd-1' }, account: { available: 0 } },
        { status: 201, statusText: 'Created' },
      );
    } else {
      request.error(new ProgressEvent('error'));
    }

    return key;
  }

  it('sends the withdrawal with an idempotency key and the environment stated', () => {
    service.withdraw('store-1', { ...WITHDRAWAL, reason: '  com espaço  ' }).subscribe();

    const request = httpMock.expectOne(WITHDRAWALS);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(request.request.body).toEqual({
      bankAccountId: 'bank-1',
      amount: 5000,
      environment: 'LIVE',
      reason: 'com espaço',
    });
    request.flush({ withdrawal: { id: 'wd-1' }, account: {} });
  });

  it('reuses the key when the same request is sent again after a failure', () => {
    // The response was lost: resending must be a replay, not a second withdrawal.
    const first = withdrawAndTakeKey();
    const second = withdrawAndTakeKey();

    expect(second).toBe(first);
  });

  it('takes a new key when the request changes, so fixing a typo is not a conflict', () => {
    const first = withdrawAndTakeKey();
    const corrected = withdrawAndTakeKey({ ...WITHDRAWAL, amount: 4000 });

    expect(corrected).not.toBe(first);
  });

  it('takes a new key after a success, because two equal withdrawals on purpose are two', () => {
    const first = withdrawAndTakeKey(WITHDRAWAL, 'ok');
    const again = withdrawAndTakeKey(WITHDRAWAL, 'ok');

    expect(again).not.toBe(first);
  });

  it('keeps withdrawal and refund intents apart even with the same amount', () => {
    service.withdraw('store-1', WITHDRAWAL).subscribe({ error: () => undefined });
    const withdrawal = httpMock.expectOne(WITHDRAWALS);

    service
      .refund('store-1', {
        paymentId: 'pay-1',
        amount: 5000,
        environment: 'LIVE',
        reason: WITHDRAWAL.reason,
      })
      .subscribe({ error: () => undefined });
    const refund = httpMock.expectOne(REFUNDS);

    expect(refund.request.headers.get('Idempotency-Key')).not.toBe(
      withdrawal.request.headers.get('Idempotency-Key'),
    );
    withdrawal.error(new ProgressEvent('error'));
    refund.error(new ProgressEvent('error'));
  });

  it('reads the Pix destinations without an environment', () => {
    let result: unknown;
    service.listBankAccounts('store-1').subscribe((accounts) => (result = accounts));

    const request = httpMock.expectOne(`${API}/operator/stores/store-1/bank-accounts`);
    expect(request.request.params.has('environment')).toBe(false);
    request.flush({ bankAccounts: [{ id: 'bank-1' }] });

    expect(result).toEqual([{ id: 'bank-1' }]);
  });
});
