import { ConfigService } from '@nestjs/config';
import { RedisDistributedLockService } from './redis-distributed-lock.service';

describe('RedisDistributedLockService', () => {
  function makeService(redis: any) {
    const config = {
      get: jest.fn(),
    } as unknown as ConfigService;

    return new RedisDistributedLockService(config, redis);
  }

  it('acquires a lock with SET NX PX and a generated token', async () => {
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn(),
      quit: jest.fn(),
    };
    const service = makeService(redis);

    const lock = await service.tryAcquire('worker:cron:test', 30000);

    expect(lock).toEqual({
      key: 'worker:cron:test',
      token: expect.any(String),
    });
    expect(redis.set).toHaveBeenCalledWith(
      'worker:cron:test',
      lock?.token,
      'PX',
      30000,
      'NX',
    );
  });

  it('returns null when the lock is already held', async () => {
    const redis = {
      set: jest.fn().mockResolvedValue(null),
      eval: jest.fn(),
      quit: jest.fn(),
    };
    const service = makeService(redis);

    await expect(service.tryAcquire('worker:cron:test', 30000)).resolves.toBeNull();
  });

  it('releases only when Redis confirms the token still owns the lock', async () => {
    const redis = {
      set: jest.fn(),
      eval: jest.fn().mockResolvedValue(1),
      quit: jest.fn(),
    };
    const service = makeService(redis);

    await expect(
      service.release({ key: 'worker:cron:test', token: 'token-1' }),
    ).resolves.toBe(true);

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("get", KEYS[1]) == ARGV[1]'),
      1,
      'worker:cron:test',
      'token-1',
    );
  });

  it('reports an unreleased lock when the token no longer owns it', async () => {
    const redis = {
      set: jest.fn(),
      eval: jest.fn().mockResolvedValue(0),
      quit: jest.fn(),
    };
    const service = makeService(redis);

    await expect(
      service.release({ key: 'worker:cron:test', token: 'stale-token' }),
    ).resolves.toBe(false);
  });
});
