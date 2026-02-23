import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  IIdempotencyCachePort,
  CachedIdempotencyResponse,
} from '@hockpay/core';

/**
 * Redis-based implementation of IIdempotencyCachePort.
 *
 * Provides fast lookup for idempotency keys using Redis.
 * Keys are prefixed with 'idempotency:' for namespacing.
 */
@Injectable()
export class IdempotencyCacheService
  implements IIdempotencyCachePort, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(IdempotencyCacheService.name);
  private readonly redis: Redis;
  private readonly keyPrefix = 'idempotency:';
  private readonly defaultTtl = 86400; // 24 hours

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error.message);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.ping();
      this.logger.log('Redis connection established');
    } catch (error) {
      this.logger.warn('Redis connection failed, falling back to no-cache mode');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }

  async get(cacheKey: string): Promise<CachedIdempotencyResponse | null> {
    try {
      const fullKey = this.getFullKey(cacheKey);
      const data = await this.redis.get(fullKey);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data) as CachedIdempotencyResponse;
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return parsed;
    } catch (error) {
      this.logger.error(`Failed to get from cache: ${error}`);
      return null;
    }
  }

  async set(
    cacheKey: string,
    response: CachedIdempotencyResponse,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const fullKey = this.getFullKey(cacheKey);
      const ttl = ttlSeconds ?? this.defaultTtl;
      const data = JSON.stringify(response);

      await this.redis.setex(fullKey, ttl, data);
      this.logger.debug(`Cached response for key: ${cacheKey}, TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`Failed to set cache: ${error}`);
      // Don't throw - caching failure shouldn't break the request
    }
  }

  async delete(cacheKey: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(cacheKey);
      await this.redis.del(fullKey);
      this.logger.debug(`Deleted cache key: ${cacheKey}`);
    } catch (error) {
      this.logger.error(`Failed to delete from cache: ${error}`);
    }
  }

  private getFullKey(cacheKey: string): string {
    return `${this.keyPrefix}${cacheKey}`;
  }
}
