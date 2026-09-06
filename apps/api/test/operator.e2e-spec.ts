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

    it('does not reach a merchant route', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/withdrawals')
        .set('Cookie', OPERATOR_COOKIE)
        .expect(401);

      expect(mocks.listWithdrawalsUseCase.execute).not.toHaveBeenCalled();
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
