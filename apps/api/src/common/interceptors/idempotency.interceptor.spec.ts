import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { IdempotencyKey, IdempotencyKeyStatus } from '@hockpay/core';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyOptions } from '../decorators/idempotent.decorator';
import {
  createIdempotencyFingerprint,
  generateIdempotencyCacheKey,
} from '../idempotency/idempotency-fingerprint';
import { getIdempotencyRequestContext } from '../idempotency/idempotency-request-context';

describe('IdempotencyInterceptor', () => {
  const handler = function handler() {};
  const controller = class TestController {};

  function makeExecutionContext(request: any, response = makeResponse()) {
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  }

  function makeResponse() {
    return {
      setHeader: jest.fn(),
      status: jest.fn(),
    };
  }

  function makeNext(result: unknown = { ok: true }): CallHandler {
    return {
      handle: jest.fn(() => of(result)),
    };
  }

  function makeRequest(overrides: Partial<any> = {}) {
    return {
      method: 'POST',
      path: '/api/v1/payments',
      body: { amount: 1000 },
      headers: { 'idempotency-key': 'idem-1' },
      store: { id: 'store-1' },
      ...overrides,
    };
  }

  function makeInterceptor(input: {
    options?: IdempotencyOptions;
    cached?: unknown;
    dbRecord?: unknown;
    repository?: any | null;
  }) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(input.options),
    };
    const cacheService = {
      get: jest.fn().mockResolvedValue(input.cached ?? null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const hasRepositoryOverride = Object.prototype.hasOwnProperty.call(
      input,
      'repository',
    );
    const repository = !hasRepositoryOverride
      ? { findCompleted: jest.fn().mockResolvedValue(input.dbRecord ?? null) }
      : input.repository;

    return {
      interceptor: new IdempotencyInterceptor(
        reflector as unknown as Reflector,
        cacheService as any,
        repository,
      ),
      reflector,
      cacheService,
      repository,
    };
  }

  function matchingCachedResponse(body = { payment: { id: 'pay-1' } }) {
    const fingerprint = createIdempotencyFingerprint({
      method: 'POST',
      path: '/api/v1/payments',
      body: { amount: 1000 },
    });

    return {
      ...fingerprint,
      responseBody: body,
      responseStatus: 201,
    };
  }

  function matchingDbRecord(body = { payment: { id: 'pay-db-1' } }) {
    const fingerprint = createIdempotencyFingerprint({
      method: 'POST',
      path: '/api/v1/payments',
      body: { amount: 1000 },
    });

    return IdempotencyKey.reconstitute({
      id: 'idem-db-1',
      key: 'idem-1',
      storeId: 'store-1',
      requestMethod: fingerprint.requestMethod,
      requestPath: fingerprint.requestPath,
      requestHash: fingerprint.requestHash,
      responseBody: body,
      responseStatus: 201,
      status: IdempotencyKeyStatus.COMPLETED,
      completedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2026-01-02T00:00:00.000Z'),
    });
  }

  it('bypasses requests without the idempotent decorator', async () => {
    const { interceptor, cacheService, repository } = makeInterceptor({});
    const request = makeRequest();
    const next = makeNext({ passed: true });

    await expect(
      lastValueFrom(interceptor.intercept(makeExecutionContext(request), next)),
    ).resolves.toEqual({ passed: true });
    expect(next.handle).toHaveBeenCalledTimes(1);
    expect(cacheService.get).not.toHaveBeenCalled();
    expect(repository.findCompleted).not.toHaveBeenCalled();
  });

  it('rejects required idempotent requests without a header', async () => {
    const { interceptor } = makeInterceptor({ options: { required: true } });
    const request = makeRequest({ headers: {} });

    await expect(
      lastValueFrom(
        interceptor.intercept(makeExecutionContext(request), makeNext()),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bypasses optional idempotent requests without a header', async () => {
    const { interceptor, cacheService } = makeInterceptor({
      options: { required: false },
    });
    const request = makeRequest({ headers: {} });
    const next = makeNext({ passed: true });

    await expect(
      lastValueFrom(interceptor.intercept(makeExecutionContext(request), next)),
    ).resolves.toEqual({ passed: true });
    expect(cacheService.get).not.toHaveBeenCalled();
  });

  it('rejects idempotent requests without store context', async () => {
    const { interceptor } = makeInterceptor({ options: { required: true } });
    const request = makeRequest({ store: undefined });

    await expect(
      lastValueFrom(
        interceptor.intercept(makeExecutionContext(request), makeNext()),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes array headers, trims keys, and exposes ttl in request context', async () => {
    const { interceptor, cacheService, repository } = makeInterceptor({
      options: { required: true, ttlSeconds: 123 },
    });
    const request = makeRequest({
      headers: { 'idempotency-key': ['  idem-array  ', 'ignored'] },
    });

    await lastValueFrom(
      interceptor.intercept(makeExecutionContext(request), makeNext()),
    );

    expect(cacheService.get).toHaveBeenCalledWith(
      generateIdempotencyCacheKey('idem-array', 'store-1'),
    );
    expect(repository.findCompleted).toHaveBeenCalledWith(
      'idem-array',
      'store-1',
    );
    expect(getIdempotencyRequestContext(request)).toEqual({
      key: 'idem-array',
      ttlSeconds: 123,
    });
  });

  it('replays a matching Redis response', async () => {
    const response = makeResponse();
    const { interceptor, repository } = makeInterceptor({
      options: { required: true },
      cached: matchingCachedResponse(),
    });

    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeExecutionContext(makeRequest(), response),
          makeNext(),
        ),
      ),
    ).resolves.toEqual({ payment: { id: 'pay-1' } });
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-idempotency-replayed',
      'true',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-idempotency-key',
      'idem-1',
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(repository.findCompleted).not.toHaveBeenCalled();
  });

  it('rejects a conflicting Redis response fingerprint', async () => {
    const cached = {
      ...matchingCachedResponse(),
      requestPath: '/api/v1/refunds',
    };
    const { interceptor } = makeInterceptor({
      options: { required: true },
      cached,
    });

    await expect(
      lastValueFrom(
        interceptor.intercept(makeExecutionContext(makeRequest()), makeNext()),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replays a matching PostgreSQL record and backfills Redis', async () => {
    const response = makeResponse();
    const dbRecord = matchingDbRecord();
    const { interceptor, cacheService } = makeInterceptor({
      options: { required: true },
      dbRecord,
    });

    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeExecutionContext(makeRequest(), response),
          makeNext(),
        ),
      ),
    ).resolves.toEqual({ payment: { id: 'pay-db-1' } });
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-idempotency-replayed',
      'true',
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(cacheService.set).toHaveBeenCalledWith(
      generateIdempotencyCacheKey('idem-1', 'store-1'),
      expect.objectContaining({
        responseBody: { payment: { id: 'pay-db-1' } },
        responseStatus: 201,
      }),
    );
  });

  it('rejects a conflicting PostgreSQL record fingerprint', async () => {
    const dbRecord = matchingDbRecord();
    jest.spyOn(dbRecord, 'matchesRequest').mockReturnValue(false);
    const { interceptor } = makeInterceptor({
      options: { required: true },
      dbRecord,
    });

    await expect(
      lastValueFrom(
        interceptor.intercept(makeExecutionContext(makeRequest()), makeNext()),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('continues on Redis and PostgreSQL cache miss', async () => {
    const { interceptor, cacheService, repository } = makeInterceptor({
      options: { required: true },
    });
    const next = makeNext({ created: true });

    await expect(
      lastValueFrom(
        interceptor.intercept(makeExecutionContext(makeRequest()), next),
      ),
    ).resolves.toEqual({ created: true });
    expect(cacheService.get).toHaveBeenCalledTimes(1);
    expect(repository.findCompleted).toHaveBeenCalledWith('idem-1', 'store-1');
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('continues in Redis-only mode when repository is not installed', async () => {
    const { interceptor, cacheService } = makeInterceptor({
      options: { required: true },
      repository: undefined,
    });
    const next = makeNext({ created: true });

    await expect(
      lastValueFrom(
        interceptor.intercept(makeExecutionContext(makeRequest()), next),
      ),
    ).resolves.toEqual({ created: true });
    expect(cacheService.get).toHaveBeenCalledTimes(1);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });
});
