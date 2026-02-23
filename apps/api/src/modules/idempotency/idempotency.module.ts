import { Module, Global } from '@nestjs/common';
import { IdempotencyCacheService } from '../../infra/services/idempotency-cache.service';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { IdempotencyKeyRepository } from '@hockpay/infrastructure';
import { PrismaService } from '../../infra/database/prisma.service';

/**
 * Idempotency Module
 *
 * Provides idempotency support for the API.
 * This module is global so the @Idempotent() decorator can be used anywhere.
 */
@Global()
@Module({
  providers: [
    // Cache service (Redis)
    IdempotencyCacheService,

    // Repository (PostgreSQL)
    {
      provide: 'IIdempotencyKeyRepository',
      useFactory: (prisma: PrismaService) => new IdempotencyKeyRepository(prisma),
      inject: [PrismaService],
    },

    // Interceptor
    IdempotencyInterceptor,
  ],
  exports: [
    IdempotencyCacheService,
    'IIdempotencyKeyRepository',
    IdempotencyInterceptor,
  ],
})
export class IdempotencyModule {}
