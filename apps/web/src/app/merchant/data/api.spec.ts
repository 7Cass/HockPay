import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NETWORK_FAILURE } from '../domain/api-error';
import { MerchantApi } from './api';

const BASE = 'http://localhost:3000/api/v1';

describe('MerchantApi', () => {
  let api: MerchantApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(MerchantApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('leitura', () => {
    it('monta a requisição que o recurso consome', () => {
      expect(api.request('/payments', { page: 2, status: 'CONFIRMED' })).toEqual({
        url: `${BASE}/payments`,
        params: { page: 2, status: 'CONFIRMED' },
      });
    });

    it('não manda parâmetro vazio para a query string', () => {
      expect(api.request('/payments', { page: 1, status: '' }).params).toEqual({ page: 1 });
    });
  });

  describe('escrita', () => {
    it('devolve o valor quando dá certo', async () => {
      const pending = api.post<{ id: string }>('/withdrawals', { amount: 100 });

      http.expectOne(`${BASE}/withdrawals`).flush({ id: 'wd_1' });

      expect(await pending).toEqual({ ok: true, value: { id: 'wd_1' } });
    });

    it('traduz o envelope da API em falha tipada', async () => {
      const pending = api.post('/withdrawals', { amount: 100 });

      http.expectOne(`${BASE}/withdrawals`).flush(
        {
          error: {
            code: 'STORE_LIVE_NOT_ENABLED',
            message: 'Store is not enabled for LIVE',
            requestId: 'req_9',
          },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      const result = await pending;
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure).toEqual({
        code: 'STORE_LIVE_NOT_ENABLED',
        message: 'Store is not enabled for LIVE',
        status: 422,
        requestId: 'req_9',
      });
    });

    it('chama o servidor que não respondeu pelo nome', async () => {
      const pending = api.post('/withdrawals', { amount: 100 });

      http.expectOne(`${BASE}/withdrawals`).error(new ProgressEvent('error'));

      const result = await pending;
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.code).toBe(NETWORK_FAILURE);
    });
  });

  describe('idempotência', () => {
    it('não manda chave quando a intenção não foi declarada', async () => {
      const pending = api.post<{ id: string }>('/stores', { name: 'Loja' });

      const request = http.expectOne(`${BASE}/stores`);
      expect(request.request.headers.has('Idempotency-Key')).toBe(false);
      request.flush({ id: 'store_1' });

      await expect(pending).resolves.toEqual({ ok: true, value: { id: 'store_1' } });
    });

    it('repete a mesma chave enquanto a intenção for a mesma', async () => {
      const intent = 'withdrawal:5000:bank_1';

      const first = api.post('/withdrawals', { amount: 5000 }, { intent });
      const one = http.expectOne(`${BASE}/withdrawals`);
      one.error(new ProgressEvent('error'));
      await first;

      const second = api.post('/withdrawals', { amount: 5000 }, { intent });
      const two = http.expectOne(`${BASE}/withdrawals`);
      two.flush({ id: 'wd_1' });
      await second;

      // A resposta perdida não pode virar um segundo saque.
      expect(one.request.headers.get('Idempotency-Key')).toBe(
        two.request.headers.get('Idempotency-Key'),
      );
    });

    it('dá chave nova para intenção diferente', async () => {
      const first = api.post('/withdrawals', { amount: 5000 }, { intent: 'withdrawal:5000' });
      const one = http.expectOne(`${BASE}/withdrawals`);
      one.flush({ id: 'wd_1' });
      await first;

      const second = api.post('/withdrawals', { amount: 6000 }, { intent: 'withdrawal:6000' });
      const two = http.expectOne(`${BASE}/withdrawals`);
      two.flush({ id: 'wd_2' });
      await second;

      // Corrigir o valor digitado é outro pedido, e chave repetida daria 409.
      expect(one.request.headers.get('Idempotency-Key')).not.toBe(
        two.request.headers.get('Idempotency-Key'),
      );
    });

    it('esquece a intenção quando ela é dada por encerrada', async () => {
      const intent = 'withdrawal:5000';

      const first = api.post('/withdrawals', { amount: 5000 }, { intent });
      const one = http.expectOne(`${BASE}/withdrawals`);
      one.flush({ id: 'wd_1' });
      await first;

      api.forget(intent);

      const second = api.post('/withdrawals', { amount: 5000 }, { intent });
      const two = http.expectOne(`${BASE}/withdrawals`);
      two.flush({ id: 'wd_2' });
      await second;

      expect(one.request.headers.get('Idempotency-Key')).not.toBe(
        two.request.headers.get('Idempotency-Key'),
      );
    });
  });
});
