import {
  BadRequestException,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of, throwError } from 'rxjs';
import { mergeMap, catchError, switchMap } from 'rxjs/operators';
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

/**
 * Header names for idempotency.
 */
const IDEMPOTENCY_HEADER = 'idempotency-key';
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
 *    - If requestHash different → 409 Conflict
 *    - If requestHash same → return cached response
 * 9. If not found in Redis, check PostgreSQL
 * 10. Continue flow and cache response after success
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: IdempotencyCacheService,
    @Optional() @Inject('IIdempotencyKeyRepository') private readonly repository: IIdempotencyKeyRepository | null,
  ) { }

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
    const idempotencyKey = request.headers[idempotencyKeyHeader()] as string | undefined;

    if (!idempotencyKey) {
      // If required=true, reject request without idempotency key
      if (options.required === true) {
        console.log('teste');
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
      return next.handle();
    }

    // 4. Generate cache key
    const cacheKey = this.generateCacheKey(idempotencyKey, storeId);
    const requestHash = this.generateRequestHash(request.body);
    const requestPath = request.path;

    // 5. Check Redis first
    return from(this.cacheService.get(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached) {
          return this.handleCachedResponse(cached, requestHash, response, idempotencyKey);
        }

        // 6. Check PostgreSQL if available
        if (this.repository !== null) {
          return from(this.repository.findByKeyAndStore(idempotencyKey, storeId)).pipe(
            switchMap((dbRecord) => {
              if (dbRecord) {
                // Check if the record has expired
                if (dbRecord.isExpired()) {
                  // Record expired - delete and proceed with new request
                  this.logger.debug(
                    `Idempotency key expired, deleting and proceeding: ${idempotencyKey}`,
                  );
                  return from(this.repository!.delete(dbRecord.id)).pipe(
                    switchMap(() =>
                      this.executeAndCache(next, {
                        cacheKey,
                        idempotencyKey,
                        storeId,
                        requestPath,
                        requestHash,
                        response,
                        ttlSeconds: options.ttlSeconds,
                      }),
                    ),
                  );
                }
                return this.handleDbRecord(dbRecord, requestHash, response, idempotencyKey);
              }

              // Not found anywhere, proceed with request
              return this.executeAndCache(next, {
                cacheKey,
                idempotencyKey,
                storeId,
                requestPath,
                requestHash,
                response,
                ttlSeconds: options.ttlSeconds,
              });
            }),
          );
        }

        // No repository, proceed with request (Redis-only mode)
        return this.executeAndCache(next, {
          cacheKey,
          idempotencyKey,
          storeId,
          requestPath,
          requestHash,
          response,
          ttlSeconds: options.ttlSeconds,
        });
      }),
    );
  }

  /**
   * Handle cached response from Redis.
   */
  private handleCachedResponse(
    cached: CachedIdempotencyResponse,
    requestHash: string,
    response: Response,
    idempotencyKey: string,
  ): Observable<unknown> {
    // Check if request body matches
    if (cached.requestHash !== requestHash) {
      this.logger.warn(
        `Idempotency key conflict: same key, different body for key ${idempotencyKey}`,
      );
      return throwError(
        () =>
          new ConflictException({
            error: {
              code: 'IDEMPOTENCY_KEY_CONFLICT',
              message:
                'Idempotency key was already used with a different request body',
            },
          }),
      );
    }

    // Return cached response
    this.logger.debug(`Returning cached response for idempotency key: ${idempotencyKey}`);
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
    requestHash: string,
    response: Response,
    idempotencyKey: string,
  ): Observable<unknown> {
    // Check if request body matches
    if (!record.matchesHash(requestHash)) {
      this.logger.warn(
        `Idempotency key conflict: same key, different body for key ${idempotencyKey}`,
      );
      return throwError(
        () =>
          new ConflictException({
            error: {
              code: 'IDEMPOTENCY_KEY_CONFLICT',
              message:
                'Idempotency key was already used with a different request body',
            },
          }),
      );
    }

    // Also cache in Redis for faster subsequent lookups
    const cacheKey = this.generateCacheKey(idempotencyKey, record.storeId);
    const cachedResponse: CachedIdempotencyResponse = {
      requestHash: record.requestHash,
      responseBody: record.responseBody,
      responseStatus: record.responseStatus,
    };

    from(this.cacheService.set(cacheKey, cachedResponse)).subscribe();

    // Return stored response
    this.logger.debug(
      `Returning PostgreSQL cached response for idempotency key: ${idempotencyKey}`,
    );
    response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true');
    response.setHeader('x-idempotency-key', idempotencyKey);
    response.status(record.responseStatus);
    return of(record.responseBody);
  }

  /**
   * Execute the request handler and cache the response.
   */
  private executeAndCache(
    next: CallHandler,
    context: {
      cacheKey: string;
      idempotencyKey: string;
      storeId: string;
      requestPath: string;
      requestHash: string;
      response: Response;
      ttlSeconds?: number;
    },
  ): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (data) => {
        const responseStatus = context.response.statusCode;
        const responseBody = data;

        // Cache in Redis
        const cachedResponse: CachedIdempotencyResponse = {
          requestHash: context.requestHash,
          responseBody,
          responseStatus,
        };

        await this.cacheService.set(
          context.cacheKey,
          cachedResponse,
          context.ttlSeconds,
        );

        // Cache in PostgreSQL if repository available
        if (this.repository !== null) {
          try {
            const idempotencyKeyEntity = IdempotencyKey.create({
              key: context.idempotencyKey,
              storeId: context.storeId,
              requestPath: context.requestPath,
              requestHash: context.requestHash,
              responseBody,
              responseStatus,
              ttlSeconds: context.ttlSeconds,
            });

            await this.repository.save(idempotencyKeyEntity);
          } catch (error) {
            // Log but don't fail - the request already succeeded
            this.logger.error(
              `Failed to save idempotency key to database: ${error}`,
            );
          }
        }

        // Set response headers
        context.response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'false');
        context.response.setHeader('x-idempotency-key', context.idempotencyKey);

        this.logger.debug(
          `Cached response for idempotency key: ${context.idempotencyKey}`,
        );

        return responseBody;
      }),
      catchError((error) => {
        // Don't cache error responses
        this.logger.debug(
          `Not caching error response for idempotency key: ${context.idempotencyKey}`,
        );
        return throwError(() => error);
      }),
    );
  }

  /**
   * Generate a cache key from idempotency key and store ID.
   */
  private generateCacheKey(idempotencyKey: string, storeId: string): string {
    const data = `${idempotencyKey}:${storeId}`;
    return this.sha256(data);
  }

  /**
   * Generate a hash of the request body.
   */
  private generateRequestHash(body: unknown): string {
    if (!body) {
      return this.sha256('');
    }
    return this.sha256(JSON.stringify(body));
  }

  /**
   * Compute SHA256 hash of a string.
   */
  private sha256(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

/**
 * Get the idempotency key header name (case-insensitive lookup).
 */
function idempotencyKeyHeader(): string {
  return IDEMPOTENCY_HEADER;
}
