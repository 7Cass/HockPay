import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

export const REDIS_DISTRIBUTED_LOCK_CLIENT = 'REDIS_DISTRIBUTED_LOCK_CLIENT';

type RedisLockClient = {
  set(
    key: string,
    value: string,
    px: 'PX',
    ttlMs: number,
    nx: 'NX',
  ): Promise<'OK' | null>;
  eval(
    script: string,
    numKeys: number,
    key: string,
    token: string,
  ): Promise<number | string>;
  quit(): Promise<unknown>;
};

export interface AcquiredRedisLock {
  key: string;
  token: string;
}

@Injectable()
export class RedisDistributedLockService implements OnModuleDestroy {
  private static readonly RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

  private readonly redis: RedisLockClient;
  private readonly ownsClient: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(REDIS_DISTRIBUTED_LOCK_CLIENT)
    redis?: RedisLockClient,
  ) {
    this.redis =
      redis ??
      (new Redis({
        host: this.configService.get<string>('REDIS_HOST') ?? 'localhost',
        port: Number(this.configService.get<string>('REDIS_PORT') ?? 6379),
        maxRetriesPerRequest: 1,
      }) as unknown as RedisLockClient);
    this.ownsClient = !redis;
  }

  async tryAcquire(key: string, ttlMs: number): Promise<AcquiredRedisLock | null> {
    const token = randomUUID();
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');

    return result === 'OK' ? { key, token } : null;
  }

  async release(lock: AcquiredRedisLock): Promise<boolean> {
    const result = await this.redis.eval(
      RedisDistributedLockService.RELEASE_SCRIPT,
      1,
      lock.key,
      lock.token,
    );

    return Number(result) === 1;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ownsClient) {
      await this.redis.quit();
    }
  }
}
