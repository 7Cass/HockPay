import { ConflictException } from '@nestjs/common';
import { Environment, IdempotencyReservationStatus } from '@hockpay/core';
import { TransactionalIdempotencyService } from './transactional-idempotency.service';

describe('TransactionalIdempotencyService', () => {
  function makeService(reservation: any) {
    const repos = {
      idempotencyKeyRepository: {
        reserve: jest.fn().mockResolvedValue(reservation),
        complete: jest.fn().mockResolvedValue(undefined),
      },
    };
    const unitOfWork = {
      execute: jest.fn((work) => work(repos)),
    };
    const cacheService = {
      set: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new TransactionalIdempotencyService(
        unitOfWork as any,
        cacheService as any,
      ),
      repos,
      unitOfWork,
      cacheService,
    };
  }

  const input = {
    idempotencyKey: 'idem-1',
    storeId: 'store-1',
    environment: Environment.TEST,
    method: 'post',
    path: '/api/v1/payments',
    body: { amount: 1000 },
    responseStatus: 201,
  };

  it('reserves the key, runs the operation, completes the record, and caches after commit', async () => {
    const { service, repos, cacheService } = makeService({
      status: IdempotencyReservationStatus.RESERVED,
      key: { id: 'db-idem-1' },
    });
    const operation = jest.fn().mockResolvedValue({ payment: { id: 'pay-1' } });

    const result = await service.execute({
      ...input,
      operation,
    });

    expect(repos.idempotencyKeyRepository.reserve).toHaveBeenCalledWith({
      key: 'idem-1',
      storeId: 'store-1',
      environment: Environment.TEST,
      requestMethod: 'POST',
      requestPath: '/api/v1/payments',
      requestHash: expect.any(String),
      ttlSeconds: undefined,
    });
    expect(operation).toHaveBeenCalledWith(repos);
    expect(repos.idempotencyKeyRepository.complete).toHaveBeenCalledWith(
      'db-idem-1',
      { payment: { id: 'pay-1' } },
      201,
    );
    expect(cacheService.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        requestMethod: 'POST',
        requestPath: '/api/v1/payments',
        responseBody: { payment: { id: 'pay-1' } },
        responseStatus: 201,
      }),
      undefined,
    );
    expect(result).toEqual({
      body: { payment: { id: 'pay-1' } },
      status: 201,
      replayed: false,
    });
  });

  it('replays a completed reservation without running the operation', async () => {
    const { service, repos } = makeService({
      status: IdempotencyReservationStatus.REPLAY,
      key: {
        responseBody: { payment: { id: 'pay-1' } },
        responseStatus: 201,
      },
    });
    const operation = jest.fn();

    const result = await service.execute({
      ...input,
      operation,
    });

    expect(operation).not.toHaveBeenCalled();
    expect(repos.idempotencyKeyRepository.complete).not.toHaveBeenCalled();
    expect(result).toEqual({
      body: { payment: { id: 'pay-1' } },
      status: 201,
      replayed: true,
    });
  });

  it('rejects a reused key with a different fingerprint before running the operation', async () => {
    const { service } = makeService({
      status: IdempotencyReservationStatus.CONFLICT,
      key: {},
    });
    const operation = jest.fn();

    await expect(
      service.execute({
        ...input,
        operation,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(operation).not.toHaveBeenCalled();
  });

  it('rejects an existing pending key before running the operation', async () => {
    const { service } = makeService({
      status: IdempotencyReservationStatus.IN_PROGRESS,
      key: {},
    });
    const operation = jest.fn();

    await expect(
      service.execute({
        ...input,
        operation,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(operation).not.toHaveBeenCalled();
  });
});
