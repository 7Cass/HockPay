import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { IdempotencyCacheService } from './idempotency-cache.service';

const mockRedisClient = {
  on: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

jest.mock('ioredis', () => jest.fn(() => mockRedisClient));

describe('IdempotencyCacheService', () => {
  let service: IdempotencyCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.ping.mockResolvedValue('PONG');
    mockRedisClient.quit.mockResolvedValue('OK');
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.setex.mockResolvedValue('OK');
    mockRedisClient.del.mockResolvedValue(1);

    service = new IdempotencyCacheService({
      get: jest.fn((key: string, fallback?: string) =>
        key === 'REDIS_URL' ? 'redis://redis.test:6380' : fallback,
      ),
    } as unknown as ConfigService);
  });

  it('creates Redis with the unified Redis env and lazy connection settings', () => {
    expect(Redis).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'redis.test',
        port: 6380,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      }),
    );
    expect(mockRedisClient.on).toHaveBeenCalledWith(
      'connect',
      expect.any(Function),
    );
    expect(mockRedisClient.on).toHaveBeenCalledWith(
      'error',
      expect.any(Function),
    );
  });

  it('returns a parsed cached response on hit', async () => {
    const cached = {
      requestMethod: 'POST',
      requestPath: '/payments',
      requestHash: 'hash-1',
      responseBody: { payment: { id: 'pay-1' } },
      responseStatus: 201,
    };
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cached));

    await expect(service.get('cache-key')).resolves.toEqual(cached);
    expect(mockRedisClient.get).toHaveBeenCalledWith(
      'idempotency:v2:cache-key',
    );
  });

  it('degrades to cache miss when Redis get fails', async () => {
    mockRedisClient.get.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(service.get('cache-key')).resolves.toBeNull();
  });

  it('degrades to cache miss when cached data cannot be parsed', async () => {
    mockRedisClient.get.mockResolvedValueOnce('{not-json');

    await expect(service.get('cache-key')).resolves.toBeNull();
  });

  it('stores responses with the supplied ttl', async () => {
    const cached = {
      requestMethod: 'POST',
      requestPath: '/payments',
      requestHash: 'hash-1',
      responseBody: { payment: { id: 'pay-1' } },
      responseStatus: 201,
    };

    await expect(
      service.set('cache-key', cached, 120),
    ).resolves.toBeUndefined();
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      'idempotency:v2:cache-key',
      120,
      JSON.stringify(cached),
    );
  });

  it('does not throw when Redis set fails', async () => {
    mockRedisClient.setex.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(
      service.set('cache-key', {
        requestMethod: 'POST',
        requestPath: '/payments',
        requestHash: 'hash-1',
        responseBody: { payment: { id: 'pay-1' } },
        responseStatus: 201,
      }),
    ).resolves.toBeUndefined();
  });
});
