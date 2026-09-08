import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApiE2eTestApp, ApiE2eMocks } from './test-app';

const OPERATOR_COOKIE = 'hockpay_op_at=valid-operator-token';
const MERCHANT_COOKIE = 'hockpay_at=valid-access-token';

describe('Operator surface boundary (e2e)', () => {
  let app: INestApplication;
  let mocks: ApiE2eMocks;

  beforeAll(async () => {
    ({ app, mocks } = await createApiE2eTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('a merchant credential does not open the operator door', () => {
    it('rejects the merchant session cookie', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/operator/me')
        .set('Cookie', MERCHANT_COOKIE)
        .expect(401);

      expect(mocks.getOperatorUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects an API key, in TEST and in LIVE', async () => {
      for (const key of ['hk_test_secret', 'hk_live_secret']) {
        await request(app.getHttpServer())
          .get('/api/v1/operator/me')
          .set('Authorization', `Bearer ${key}`)
          .expect(401);
      }

      expect(mocks.validateApiKeyUseCase.execute).not.toHaveBeenCalled();
      expect(mocks.getOperatorUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects a merchant token placed in the operator cookie', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/operator/me')
        .set('Cookie', 'hockpay_op_at=valid-access-token')
        .expect(401);
    });

    it('rejects no credential at all', async () => {
      await request(app.getHttpServer()).get('/api/v1/operator/me').expect(401);
    });

    it('rejects a merchant on the desk routes that carry the new power', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/operator/stores')
        .set('Cookie', MERCHANT_COOKIE)
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/operator/stores/store-1/live-status')
        .set('Cookie', MERCHANT_COOKIE)
        .send({ decision: 'approve', reason: 'nao deveria passar' })
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/operator/stores')
        .set('Authorization', 'Bearer hk_live_secret')
        .expect(401);

      expect(mocks.listStoresForOperatorUseCase.execute).not.toHaveBeenCalled();
      expect(mocks.decideLiveEnablementUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects a merchant on the commercial terms route', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/operator/stores/store-1/commercial-terms')
        .set('Cookie', MERCHANT_COOKIE)
        .send({
          feePercent: 0,
          feeFixed: 0,
          settlementDays: 0,
          reason: 'nao deveria passar',
        })
        .expect(401);

      expect(mocks.updateCommercialTermsUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects a merchant on every cross-merchant read', async () => {
      const reads = [
        '/api/v1/operator/stores/store-1',
        '/api/v1/operator/stores/store-1/payments?environment=LIVE',
        '/api/v1/operator/stores/store-1/payments/pay-1/timeline?environment=LIVE',
        '/api/v1/operator/stores/store-1/account?environment=LIVE',
        '/api/v1/operator/stores/store-1/transactions?environment=LIVE',
        '/api/v1/operator/stores/store-1/webhooks',
        '/api/v1/operator/stores/store-1/webhooks/logs',
      ];

      for (const path of reads) {
        await request(app.getHttpServer())
          .get(path)
          .set('Cookie', MERCHANT_COOKIE)
          .expect(401);

        await request(app.getHttpServer())
          .get(path)
          .set('Authorization', 'Bearer hk_live_secret')
          .expect(401);
      }

      // A merchant's own store is still a store somebody else's session must
      // not read from here: none of the use cases was even reached.
      expect(mocks.getStoreForOperatorUseCase.execute).not.toHaveBeenCalled();
      expect(mocks.operatorListPaymentsUseCase.execute).not.toHaveBeenCalled();
      expect(mocks.operatorGetAccountUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('an operator session opens only the operator door', () => {
    it('reads the operator behind the session', async () => {
      mocks.getOperatorUseCase.execute.mockResolvedValue({
        id: 'operator-1',
        name: 'Desk',
        email: 'desk@hockpay.local',
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/operator/me')
        .set('Cookie', OPERATOR_COOKIE)
        .expect(200);

      expect(response.body).toEqual({
        id: 'operator-1',
        name: 'Desk',
        email: 'desk@hockpay.local',
      });
      expect(mocks.getOperatorUseCase.execute).toHaveBeenCalledWith({
        operatorId: 'operator-1',
      });
    });

    it('reads the audit trail', async () => {
      mocks.listOperatorAuditLogsUseCase.execute.mockResolvedValue({
        data: [],
        limit: 50,
        offset: 0,
      });

      await request(app.getHttpServer())
        .get('/api/v1/operator/audit-logs?limit=10')
        .set('Cookie', OPERATOR_COOKIE)
        .expect(200);

      expect(mocks.listOperatorAuditLogsUseCase.execute).toHaveBeenCalledWith({
        limit: 10,
        offset: undefined,
        operatorId: undefined,
      });
    });

    it('reads the enablement queue', async () => {
      mocks.listStoresForOperatorUseCase.execute.mockResolvedValue({
        data: [],
        limit: 50,
        offset: 0,
      });

      await request(app.getHttpServer())
        .get('/api/v1/operator/stores?liveStatus=PENDING')
        .set('Cookie', OPERATOR_COOKIE)
        .expect(200);

      expect(mocks.listStoresForOperatorUseCase.execute).toHaveBeenCalledWith({
        liveStatus: 'PENDING',
        limit: undefined,
        offset: undefined,
      });
    });

    it('decides an enablement, carrying operator and request id', async () => {
      mocks.decideLiveEnablementUseCase.execute.mockResolvedValue({
        store: { id: 'store-1', liveStatus: 'APPROVED' },
      });

      await request(app.getHttpServer())
        .post('/api/v1/operator/stores/store-1/live-status')
        .set('Cookie', OPERATOR_COOKIE)
        .set('x-request-id', 'req-decision-1')
        .send({ decision: 'approve', reason: 'documentos conferidos' })
        .expect(200);

      expect(mocks.decideLiveEnablementUseCase.execute).toHaveBeenCalledWith({
        operatorId: 'operator-1',
        storeId: 'store-1',
        decision: 'approve',
        reason: 'documentos conferidos',
        requestId: 'req-decision-1',
      });
    });

    it('does not reach a merchant route', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/withdrawals')
        .set('Cookie', OPERATOR_COOKIE)
        .expect(401);

      expect(mocks.listWithdrawalsUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('the desk investigates a store', () => {
    it('records the investigation when the store is opened', async () => {
      mocks.getStoreForOperatorUseCase.execute.mockResolvedValue({
        store: { id: 'store-1', name: 'Ateliê Corvo', liveStatus: 'APPROVED' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/operator/stores/store-1')
        .set('Cookie', OPERATOR_COOKIE)
        .expect(200);

      expect(response.body.store.id).toBe('store-1');
      expect(mocks.getStoreForOperatorUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: 'operator-1',
          storeId: 'store-1',
        }),
      );
    });

    it('refuses a read without an environment instead of assuming TEST', async () => {
      // An operator investigating a production incident who silently receives
      // the TEST ledger draws the wrong conclusion from correct data.
      await request(app.getHttpServer())
        .get('/api/v1/operator/stores/store-1/account')
        .set('Cookie', OPERATOR_COOKIE)
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/v1/operator/stores/store-1/transactions?environment=STAGING')
        .set('Cookie', OPERATOR_COOKIE)
        .expect(400);

      expect(mocks.operatorGetAccountUseCase.execute).not.toHaveBeenCalled();
      expect(
        mocks.operatorListTransactionsUseCase.execute,
      ).not.toHaveBeenCalled();
    });

    it('reads the ledger of the environment the operator asked for', async () => {
      mocks.operatorGetAccountUseCase.execute.mockResolvedValue({
        account: { id: 'acc-live', availableBalance: 5000 },
      });

      await request(app.getHttpServer())
        .get('/api/v1/operator/stores/store-1/account?environment=LIVE')
        .set('Cookie', OPERATOR_COOKIE)
        .expect(200);

      expect(mocks.operatorGetAccountUseCase.execute).toHaveBeenCalledWith({
        storeId: 'store-1',
        environment: 'LIVE',
      });
    });

    it('leaves the webhook secret behind, keeping only the prefix', async () => {
      mocks.operatorListWebhookConfigsUseCase.execute.mockResolvedValue({
        webhookConfigs: [
          {
            id: 'webhook-1',
            toPublicObject: () => ({
              id: 'webhook-1',
              url: 'https://example.test/hook',
              prefix: 'whsec_PLANT',
            }),
            toObject: () => ({ id: 'webhook-1', secret: 'whsec_LEAKED' }),
          },
        ],
        circuits: { 'webhook-1': { state: 'closed' } },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/operator/stores/store-1/webhooks')
        .set('Cookie', OPERATOR_COOKIE)
        .expect(200);

      expect(response.body.webhooks[0].prefix).toBe('whsec_PLANT');
      expect(JSON.stringify(response.body)).not.toContain('whsec_LEAKED');
      expect(response.body.webhooks[0].secret).toBeUndefined();
    });
  });

  describe('the desk sets a commercial condition', () => {
    it('carries operator, the three fields and the reason into the use case', async () => {
      mocks.updateCommercialTermsUseCase.execute.mockResolvedValue({
        store: {
          id: 'store-1',
          feePercent: 2.9,
          feeFixed: 39,
          settlementDays: 2,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/operator/stores/store-1/commercial-terms')
        .set('Cookie', OPERATOR_COOKIE)
        .send({
          feePercent: 2.9,
          feeFixed: 39,
          settlementDays: 2,
          reason: 'plano anual',
        })
        .expect(200);

      expect(response.body.store.feePercent).toBe(2.9);
      expect(mocks.updateCommercialTermsUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: 'operator-1',
          storeId: 'store-1',
          feePercent: 2.9,
          feeFixed: 39,
          settlementDays: 2,
          reason: 'plano anual',
        }),
      );
    });

    it('refuses a partial condition at the door', async () => {
      // The three fields move together. A partial body leaves the trail's
      // before/after describing something nobody decided.
      await request(app.getHttpServer())
        .post('/api/v1/operator/stores/store-1/commercial-terms')
        .set('Cookie', OPERATOR_COOKIE)
        .send({ feePercent: 2.9, reason: 'so a taxa' })
        .expect(400);

      expect(mocks.updateCommercialTermsUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('closes the session of the authenticated operator, not of a cookie', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/operator/auth/logout')
        .set('Cookie', OPERATOR_COOKIE)
        .set('x-request-id', 'req-operator-logout')
        .expect(204);

      expect(mocks.operatorLogoutUseCase.execute).toHaveBeenCalledWith({
        operatorId: 'operator-1',
        requestId: 'req-operator-logout',
      });
    });

    it('needs an operator session of its own', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/operator/auth/logout')
        .set('Cookie', MERCHANT_COOKIE)
        .expect(401);

      expect(mocks.operatorLogoutUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('sets the operator cookies on their own paths', async () => {
      mocks.operatorLoginUseCase.execute.mockResolvedValue({
        accessToken: 'operator-access',
        refreshToken: 'operator-refresh',
        expiresIn: 900,
        operator: {
          id: 'operator-1',
          name: 'Desk',
          email: 'desk@hockpay.local',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/operator/auth/login')
        .send({ email: 'desk@hockpay.local', password: 'secret' })
        .expect(200);

      const cookies = response.headers['set-cookie'] as unknown as string[];

      expect(cookies).toEqual(
        expect.arrayContaining([
          expect.stringContaining('hockpay_op_at=operator-access'),
          expect.stringContaining('hockpay_op_rt=operator-refresh'),
        ]),
      );
      expect(cookies.join(';')).toContain('Path=/api/v1/operator/auth/refresh');
      expect(response.body).not.toHaveProperty('accessToken');
    });

    it('carries the request id into the trail', async () => {
      mocks.operatorLoginUseCase.execute.mockResolvedValue({
        accessToken: 'operator-access',
        refreshToken: 'operator-refresh',
        expiresIn: 900,
        operator: { id: 'operator-1', name: 'Desk', email: 'desk@x.local' },
      });

      await request(app.getHttpServer())
        .post('/api/v1/operator/auth/login')
        .set('x-request-id', 'req-operator-1')
        .send({ email: 'desk@hockpay.local', password: 'secret' })
        .expect(200);

      expect(mocks.operatorLoginUseCase.execute).toHaveBeenCalledWith({
        email: 'desk@hockpay.local',
        password: 'secret',
        requestId: 'req-operator-1',
      });
    });
  });
});
