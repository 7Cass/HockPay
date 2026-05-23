import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { InvalidSlugFormatError, SlugAlreadyExistsError } from '@hockpay/core';
import { createApiE2eTestApp, ApiE2eMocks } from './test-app';

const merchant = {
  id: 'merchant-1',
  name: 'Smoke Merchant',
  email: 'merchant@hockpay.local',
  document: '12345678909',
  formattedDocument: '123.456.789-09',
  documentType: 'CPF' as const,
};

const store = {
  id: 'store-1',
  merchantId: 'merchant-1',
  name: 'Main Store',
  slug: 'main-store',
  isActive: true,
  isApproved: true,
  settlementDays: 2,
  feePercent: 2.99,
  feeFixed: 49,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function setCookies(response: request.Response): string[] {
  const header = response.headers['set-cookie'];
  if (!header) {
    return [];
  }

  return Array.isArray(header) ? header : [header];
}

describe('API HTTP boundary (e2e)', () => {
  let app: INestApplication;
  let mocks: ApiE2eMocks;

  beforeEach(async () => {
    const testApp = await createApiE2eTestApp();
    app = testApp.app;
    mocks = testApp.mocks;
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live returns liveness and request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('x-request-id', 'e2e-request-id')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBe('e2e-request-id');
  });

  it('auth login, refresh and logout manage HTTP-only cookies', async () => {
    mocks.loginUseCase.execute.mockResolvedValue({
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresIn: 900,
      merchant,
    });
    mocks.refreshTokenUseCase.execute.mockResolvedValue({
      accessToken: 'access-token-2',
      refreshToken: 'refresh-token-2',
      expiresIn: 900,
    });
    mocks.logoutUseCase.execute.mockResolvedValue(undefined);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: merchant.email, password: '12345678' })
      .expect(200);

    expect(mocks.loginUseCase.execute).toHaveBeenCalledWith({
      email: merchant.email,
      password: '12345678',
    });
    expect(login.body).toMatchObject({
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresIn: 900,
      merchant,
    });
    expect(setCookies(login)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('hockpay_at=access-token-1'),
        expect.stringContaining('hockpay_rt=refresh-token-1'),
      ]),
    );

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'hockpay_rt=refresh-token-1')
      .expect(200);

    expect(mocks.refreshTokenUseCase.execute).toHaveBeenCalledWith({
      refreshToken: 'refresh-token-1',
    });
    expect(refresh.body).toMatchObject({
      accessToken: 'access-token-2',
      refreshToken: 'refresh-token-2',
      expiresIn: 900,
    });
    expect(setCookies(refresh)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('hockpay_at=access-token-2'),
        expect.stringContaining('hockpay_rt=refresh-token-2'),
      ]),
    );

    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', 'hockpay_rt=refresh-token-2')
      .expect(204);

    expect(mocks.logoutUseCase.execute).toHaveBeenCalledWith({
      refreshToken: 'refresh-token-2',
    });
    expect(setCookies(logout)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('hockpay_at='),
        expect.stringContaining('hockpay_rt='),
      ]),
    );
  });

  it('GET /api/v1/stores requires a JWT cookie and lists stores', async () => {
    mocks.listStoresUseCase.execute.mockResolvedValue({ stores: [store] });

    await request(app.getHttpServer()).get('/api/v1/stores').expect(401);

    const response = await request(app.getHttpServer())
      .get('/api/v1/stores')
      .set('Cookie', 'hockpay_at=valid-access-token')
      .expect(200);

    expect(mocks.listStoresUseCase.execute).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
    });
    expect(response.body.stores).toHaveLength(1);
    expect(response.body.stores[0]).toMatchObject({
      id: 'store-1',
      merchantId: 'merchant-1',
      slug: 'main-store',
    });
  });

  it('POST /api/v1/stores creates a store and returns store-context tokens', async () => {
    mocks.createStoreUseCase.execute.mockResolvedValue({
      store,
      accessToken: 'store-access-token',
      refreshToken: 'store-refresh-token',
      expiresIn: 900,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Cookie', 'hockpay_at=valid-access-token')
      .send({ name: 'Main Store', slug: 'main-store' })
      .expect(201);

    expect(mocks.createStoreUseCase.execute).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      name: 'Main Store',
      slug: 'main-store',
    });
    expect(response.body).toMatchObject({
      accessToken: 'store-access-token',
      refreshToken: 'store-refresh-token',
      expiresIn: 900,
      store: {
        id: 'store-1',
        slug: 'main-store',
      },
    });
    expect(setCookies(response)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('hockpay_at=store-access-token'),
        expect.stringContaining('hockpay_rt=store-refresh-token'),
      ]),
    );
  });

  it('POST /api/v1/stores returns validation errors before the use case', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Cookie', 'hockpay_at=valid-access-token')
      .send({ name: 'Main Store', slug: 'Invalid Slug' })
      .expect(400);

    expect(mocks.createStoreUseCase.execute).not.toHaveBeenCalled();
    expect(response.body.error).toMatchObject({
      code: 'BAD_REQUEST',
      statusCode: 400,
    });
  });

  it('POST /api/v1/stores maps duplicate and invalid slug domain errors', async () => {
    mocks.createStoreUseCase.execute.mockRejectedValueOnce(
      new SlugAlreadyExistsError('main-store'),
    );

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Cookie', 'hockpay_at=valid-access-token')
      .send({ name: 'Main Store', slug: 'main-store' })
      .expect(409);

    expect(duplicate.body.error).toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });

    mocks.createStoreUseCase.execute.mockRejectedValueOnce(
      new InvalidSlugFormatError('bad-slug'),
    );

    const invalid = await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Cookie', 'hockpay_at=valid-access-token')
      .send({ name: 'Main Store', slug: 'bad-slug' })
      .expect(400);

    expect(invalid.body.error).toMatchObject({
      code: 'BAD_REQUEST',
      statusCode: 400,
    });
  });

  it('GET /api/v1/withdrawals returns NO_CURRENT_STORE for a valid JWT without store context', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/withdrawals')
      .set('Cookie', 'hockpay_at=valid-access-token-without-store')
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: 'NO_CURRENT_STORE',
      statusCode: 403,
    });
    expect(response.body.error.code).not.toBe('FORBIDDEN');
    expect(mocks.listWithdrawalsUseCase.execute).not.toHaveBeenCalled();
    expect(
      mocks.createWithdrawalUseCase.executeInTransaction,
    ).not.toHaveBeenCalled();
    expect(mocks.getWithdrawalUseCase.execute).not.toHaveBeenCalled();
    expect(
      mocks.transactionalIdempotencyService.execute,
    ).not.toHaveBeenCalled();
  });

  it('POST /api/v1/withdrawals returns NO_CURRENT_STORE before withdrawal or idempotency operation for a valid JWT without store context', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/withdrawals')
      .set('Cookie', 'hockpay_at=valid-access-token-without-store')
      .set('Idempotency-Key', 'withdrawal-no-store-1')
      .send({ bankAccountId: 'bank-account-1', amount: 1000 })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: 'NO_CURRENT_STORE',
      statusCode: 403,
    });
    expect(response.body.error.code).not.toBe('FORBIDDEN');
    expect(response.body.error.code).not.toBe('IDEMPOTENCY_STORE_REQUIRED');
    expect(
      mocks.createWithdrawalUseCase.executeInTransaction,
    ).not.toHaveBeenCalled();
    expect(mocks.listWithdrawalsUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.getWithdrawalUseCase.execute).not.toHaveBeenCalled();
    expect(
      mocks.transactionalIdempotencyService.execute,
    ).not.toHaveBeenCalled();
  });
});
