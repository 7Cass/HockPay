import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  Inject,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import {
  IIdempotencyKeyRepository,
  IdempotencyKey,
  CachedIdempotencyResponse,
} from '@hockpay/core';
import {
  IDEMPOTENCY_KEY,
  IdempotencyOptions,
} from '../decorators/idempotent.decorator';
import { IdempotencyCacheService } from '../../infra/services/idempotency-cache.service';
import {
  createIdempotencyFingerprint,
  generateIdempotencyCacheKey,
  IdempotencyFingerprint,
  matchesIdempotencyFingerprint,
} from '../idempotency/idempotency-fingerprint';
import {
  readIdempotencyKeyHeader,
  setIdempotencyRequestContext,
} from '../idempotency/idempotency-request-context';

/**
 * Header names for idempotency.
 */
const IDEMPOTENCY_REPLAYED_HEADER = 'x-idempotency-replayed';

/**
 * Interceptor for handling idempotent requests.
 *
 * Flow:
 * 1. Check if endpoint has @Idempotent() decorator
 * 2. If not, continue normal flow
 * 3. Read Idempotency-Key header
 * 4. If no header, continue normal flow
 * 5. Get storeId from request (injected by CombinedAuthGuard)
 * 6. Generate cache key: SHA256(key + storeId)
 * 7. Check Redis first
 * 8. If found:
 *    - If requestHash different -> 409 Conflict
 *    - If requestHash same -> return cached response
 * 9. If not found in Redis, check PostgreSQL
 * 10. Continue flow. Financial endpoints complete idempotency inside the
 *     same UnitOfWork as the mutation.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: IdempotencyCacheService,
    @Optional()
    @Inject('IIdempotencyKeyRepository')
    private readonly repository: IIdempotencyKeyRepository | null,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // 1. Check if endpoint has @Idempotent() decorator
    const options = this.reflector.getAllAndOverride<IdempotencyOptions>(
      IDEMPOTENCY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return next.handle();
    }

    // 2. Read Idempotency-Key header
    const idempotencyKey = readIdempotencyKeyHeader(request);

    if (!idempotencyKey) {
      // If required=true, reject request without idempotency key
      if (options.required === true) {
        return throwError(
          () =>
            new BadRequestException({
              error: {
                code: 'IDEMPOTENCY_KEY_REQUIRED',
                message: 'The Idempotency-Key header is required for this endpoint',
              },
            }),
        );
      }
      // No idempotency key provided, continue normal flow
      return next.handle();
    }

    // 3. Get storeId from request (injected by CombinedAuthGuard)
    const storeId = (request as any).store?.id;

    if (!storeId) {
      this.logger.warn('Idempotency key provided but no storeId in request');
      return throwError(
        () =>
          new BadRequestException({
            error: {
              code: 'IDEMPOTENCY_STORE_REQUIRED',
              message: 'A store context is required for idempotent requests',
            },
          }),
      );
    }

    // 4. Generate cache key
    const cacheKey = generateIdempotencyCacheKey(idempotencyKey, storeId);
    const fingerprint = createIdempotencyFingerprint({
      method: request.method,
      path: request.path,
      body: request.body,
    });
    setIdempotencyRequestContext(request, {
      key: idempotencyKey,
      ttlSeconds: options.ttlSeconds,
    });

    // 5. Check Redis first
    return from(this.cacheService.get(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached) {
          return this.handleCachedResponse(
            cached,
            fingerprint,
            response,
            idempotencyKey,
          );
        }

        // 6. Check PostgreSQL if available
        if (this.repository !== null) {
          return from(
            this.repository.findCompleted(idempotencyKey, storeId),
          ).pipe(
            switchMap((dbRecord) => {
              if (dbRecord) {
                return this.handleDbRecord(
                  dbRecord,
                  fingerprint,
                  response,
                  idempotencyKey,
                );
              }

              // Not found anywhere, proceed with request
              return next.handle();
            }),
          );
        }

        // No repository, proceed with request (Redis-only mode)
        return next.handle();
      }),
    );
  }

  /**
   * Handle cached response from Redis.
   */
  private handleCachedResponse(
    cached: CachedIdempotencyResponse,
    fingerprint: IdempotencyFingerprint,
    response: Response,
    idempotencyKey: string,
  ): Observable<unknown> {
    // Check if request body matches
    if (!matchesIdempotencyFingerprint(cached, fingerprint)) {
      this.logger.warn(
        `Idempotency key conflict: same key, different request for key ${idempotencyKey}`,
      );
      return throwError(
        () =>
          new ConflictException({
            error: {
              code: 'IDEMPOTENCY_KEY_CONFLICT',
              message:
                'Idempotency key was already used with a different request',
            },
          }),
      );
    }

    // Return cached response
    this.logger.debug(
      `Returning cached response for idempotency key: ${idempotencyKey}`,
    );
    response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true');
    response.setHeader('x-idempotency-key', idempotencyKey);
    response.status(cached.responseStatus);
    return of(cached.responseBody);
  }

  /**
   * Handle record from PostgreSQL.
   */
  private handleDbRecord(
    record: IdempotencyKey,
    fingerprint: IdempotencyFingerprint,
    response: Response,
    idempotencyKey: string,
  ): Observable<unknown> {
    // Check if request body matches
    if (
      !record.matchesRequest({
        requestMethod: fingerprint.requestMethod,
        requestPath: fingerprint.requestPath,
        requestHash: fingerprint.requestHash,
      })
    ) {
      this.logger.warn(
        `Idempotency key conflict: same key, different request for key ${idempotencyKey}`,
      );
      return throwError(
        () =>
          new ConflictException({
            error: {
              code: 'IDEMPOTENCY_KEY_CONFLICT',
              message:
                'Idempotency key was already used with a different request',
            },
          }),
      );
    }

    // Also cache in Redis for faster subsequent lookups
    const cacheKey = generateIdempotencyCacheKey(
      idempotencyKey,
      record.storeId,
    );
    const cachedResponse: CachedIdempotencyResponse = {
      requestMethod: record.requestMethod,
      requestPath: record.requestPath,
      requestHash: record.requestHash,
      responseBody: record.responseBody!,
      responseStatus: record.responseStatus!,
    };

    from(this.cacheService.set(cacheKey, cachedResponse)).subscribe();

    // Return stored response
    this.logger.debug(
      `Returning PostgreSQL cached response for idempotency key: ${idempotencyKey}`,
    );
    response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true');
    response.setHeader('x-idempotency-key', idempotencyKey);
    response.status(record.responseStatus!);
    return of(record.responseBody);
  }
}
