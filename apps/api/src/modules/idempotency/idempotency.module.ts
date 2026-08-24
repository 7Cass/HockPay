import { Module, Global } from '@nestjs/common';
import { IdempotencyCacheService } from '../../infra/services/idempotency-cache.service';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { TransactionalIdempotencyService } from '../../common/idempotency/transactional-idempotency.service';

/**
 * Idempotency Module
 *
 * Provides idempotency support for the API.
 * This module is global so the @Idempotent() decorator can be used anywhere.
 *
 * `IIdempotencyKeyRepository` e `IUnitOfWork` vem do InfrastructureModule
 * global — registra-los aqui tambem criaria duas instancias do mesmo token.
 */
@Global()
@Module({
  providers: [
    IdempotencyCacheService,
    IdempotencyInterceptor,
    TransactionalIdempotencyService,
  ],
  exports: [
    IdempotencyCacheService,
    IdempotencyInterceptor,
    TransactionalIdempotencyService,
  ],
})
export class IdempotencyModule {}
