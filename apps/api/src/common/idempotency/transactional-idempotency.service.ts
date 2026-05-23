import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { IdempotencyReservationStatus } from '@hockpay/core';
import type {
  CachedIdempotencyResponse,
  ITransactedRepositories,
  IUnitOfWork,
} from '@hockpay/core';
import { IdempotencyCacheService } from '../../infra/services/idempotency-cache.service';
import {
  createIdempotencyFingerprint,
  generateIdempotencyCacheKey,
} from './idempotency-fingerprint';

export interface TransactionalIdempotencyInput<TResponse> {
  idempotencyKey: string;
  storeId: string;
  method: string;
  path: string;
  body: unknown;
  responseStatus: number;
  ttlSeconds?: number;
  operation: (repos: ITransactedRepositories) => Promise<TResponse>;
}

export interface TransactionalIdempotencyResult<TResponse> {
  body: TResponse;
  status: number;
  replayed: boolean;
}

@Injectable()
export class TransactionalIdempotencyService {
  constructor(
    @Inject('IUnitOfWork') private readonly unitOfWork: IUnitOfWork,
    private readonly cacheService: IdempotencyCacheService,
  ) {}

  async execute<TResponse extends object>(
    input: TransactionalIdempotencyInput<TResponse>,
  ): Promise<TransactionalIdempotencyResult<TResponse>> {
    const fingerprint = createIdempotencyFingerprint({
      method: input.method,
      path: input.path,
      body: input.body,
    });

    const result = await this.unitOfWork.execute(async (repos) => {
      const reservation = await repos.idempotencyKeyRepository.reserve({
        key: input.idempotencyKey,
        storeId: input.storeId,
        requestMethod: fingerprint.requestMethod,
        requestPath: fingerprint.requestPath,
        requestHash: fingerprint.requestHash,
        ttlSeconds: input.ttlSeconds,
      });

      if (reservation.status === IdempotencyReservationStatus.CONFLICT) {
        throw new ConflictException({
          error: {
            code: 'IDEMPOTENCY_KEY_CONFLICT',
            message:
              'Idempotency key was already used with a different request',
          },
        });
      }

      if (reservation.status === IdempotencyReservationStatus.IN_PROGRESS) {
        throw new ConflictException({
          error: {
            code: 'IDEMPOTENCY_KEY_IN_PROGRESS',
            message: 'Idempotency key is currently being processed',
          },
        });
      }

      if (reservation.status === IdempotencyReservationStatus.REPLAY) {
        return {
          body: reservation.key.responseBody as TResponse,
          status: reservation.key.responseStatus!,
          replayed: true,
        };
      }

      const body = await input.operation(repos);
      const persistedBody = this.toJsonRecord(body);
      await repos.idempotencyKeyRepository.complete(
        reservation.key.id,
        persistedBody,
        input.responseStatus,
      );

      return {
        body,
        status: input.responseStatus,
        replayed: false,
      };
    });

    await this.cacheCompletedResponse({
      idempotencyKey: input.idempotencyKey,
      storeId: input.storeId,
      ttlSeconds: input.ttlSeconds,
      response: {
        requestMethod: fingerprint.requestMethod,
        requestPath: fingerprint.requestPath,
        requestHash: fingerprint.requestHash,
        responseBody: this.toJsonRecord(result.body),
        responseStatus: result.status,
      },
    });

    return result;
  }

  private async cacheCompletedResponse(input: {
    idempotencyKey: string;
    storeId: string;
    ttlSeconds?: number;
    response: CachedIdempotencyResponse;
  }): Promise<void> {
    try {
      await this.cacheService.set(
        generateIdempotencyCacheKey(input.idempotencyKey, input.storeId),
        input.response,
        input.ttlSeconds,
      );
    } catch {
      // Redis is an optimization only; PostgreSQL remains the source of truth.
    }
  }

  private toJsonRecord(value: object): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }
}
