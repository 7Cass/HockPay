import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  EMPTY_PAGE,
  PAYMENT_QUERY,
  type PaymentQuery,
  paymentsParams,
  paymentsResource,
} from './payments';

const BASE = 'http://localhost:3000/api/v1';

describe('pagamentos', () => {
  describe('parâmetros', () => {
    it('manda só página e limite quando nada foi filtrado', () => {
      expect(paymentsParams(PAYMENT_QUERY)).toEqual({ page: 1, limit: 20 });
    });

    it('traduz a busca da tela para o vocabulário da API', () => {
      const params = paymentsParams({ ...PAYMENT_QUERY, q: '  FIG-11134  ' });

      // A tela chama de busca; a API chama de externalId.
      expect(params).toEqual({ page: 1, limit: 20, externalId: 'FIG-11134' });
    });

    it('ignora busca que é só espaço', () => {
      expect(paymentsParams({ ...PAYMENT_QUERY, q: '   ' })).toEqual({ page: 1, limit: 20 });
    });

    it('leva status e período quando escolhidos', () => {
      const params = paymentsParams({
        ...PAYMENT_QUERY,
        status: 'CONFIRMED',
        startDate: '2026-09-01',
        endDate: '2026-09-15',
        page: 3,
      });

      expect(params).toEqual({
        page: 3,
        limit: 20,
        status: 'CONFIRMED',
        startDate: '2026-09-01',
        endDate: '2026-09-15',
      });
    });
  });

  describe('recurso', () => {
    let http: HttpTestingController;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    /** O recurso dispara no tick; o valor chega uma microtarefa depois dele. */
    async function settle(): Promise<void> {
      TestBed.tick();
      await Promise.resolve();
      TestBed.tick();
    }

    it('busca a lista e refaz sozinho quando a query muda', async () => {
      const query = signal<PaymentQuery>(PAYMENT_QUERY);
      const payments = TestBed.runInInjectionContext(() => paymentsResource(query));

      // Antes da resposta, a tela já tem uma lista — vazia, não `undefined`.
      expect(payments.value()).toEqual(EMPTY_PAGE);

      await settle();
      const first = http.expectOne((request) => request.url === `${BASE}/payments`);
      expect(first.request.params.get('page')).toBe('1');
      first.flush({ ...EMPTY_PAGE, total: 1092 });
      await settle();

      expect(payments.value().total).toBe(1092);

      query.set({ ...PAYMENT_QUERY, status: 'FAILED', page: 2 });
      await settle();

      const second = http.expectOne((request) => request.url === `${BASE}/payments`);
      expect(second.request.params.get('status')).toBe('FAILED');
      expect(second.request.params.get('page')).toBe('2');
      second.flush(EMPTY_PAGE);
      await settle();
    });
  });
});
