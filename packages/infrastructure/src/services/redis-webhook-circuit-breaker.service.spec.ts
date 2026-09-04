import { describe, expect, it, vi } from 'vitest';
import {
  RedisWebhookCircuitBreakerService,
  WebhookCircuitRedisClient,
} from './redis-webhook-circuit-breaker.service';

function makeRedis(): WebhookCircuitRedisClient & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  };
}

describe('RedisWebhookCircuitBreakerService', () => {
  it('stays closed until the threshold of consecutive transport failures', async () => {
    const redis = makeRedis();
    const breaker = new RedisWebhookCircuitBreakerService(redis, { failureThreshold: 3 });

    await breaker.recordTransportFailure('config-1');
    await breaker.recordTransportFailure('config-1');

    expect(await breaker.shouldAttempt('config-1')).toBe(true);

    const opened = await breaker.recordTransportFailure('config-1');
    expect(opened.state).toBe('open');
    expect(opened.consecutiveFailures).toBe(3);
    expect(await breaker.shouldAttempt('config-1')).toBe(false);
  });

  it('gives the destination another chance once the open window passes', async () => {
    const redis = makeRedis();
    let now = new Date('2026-05-15T12:00:00.000Z');
    const breaker = new RedisWebhookCircuitBreakerService(redis, {
      failureThreshold: 1,
      openMs: 60_000,
      now: () => now,
    });

    await breaker.recordTransportFailure('config-1');
    expect(await breaker.shouldAttempt('config-1')).toBe(false);

    // Meio-aberto sem estado proprio: passada a janela, a proxima tentativa vai.
    now = new Date('2026-05-15T12:01:01.000Z');
    expect(await breaker.shouldAttempt('config-1')).toBe(true);
  });

  it('reopens immediately when the retried destination fails again', async () => {
    const redis = makeRedis();
    let now = new Date('2026-05-15T12:00:00.000Z');
    const breaker = new RedisWebhookCircuitBreakerService(redis, {
      failureThreshold: 2,
      openMs: 60_000,
      now: () => now,
    });

    await breaker.recordTransportFailure('config-1');
    await breaker.recordTransportFailure('config-1');
    now = new Date('2026-05-15T12:01:01.000Z');
    expect(await breaker.shouldAttempt('config-1')).toBe(true);

    const reopened = await breaker.recordTransportFailure('config-1');
    expect(reopened.state).toBe('open');
    expect(reopened.consecutiveFailures).toBe(3);
  });

  it('closes on the first success', async () => {
    const redis = makeRedis();
    const breaker = new RedisWebhookCircuitBreakerService(redis, { failureThreshold: 1 });

    await breaker.recordTransportFailure('config-1');
    expect(await breaker.shouldAttempt('config-1')).toBe(false);

    await breaker.recordSuccess('config-1');

    expect(await breaker.shouldAttempt('config-1')).toBe(true);
    expect(await breaker.status('config-1')).toEqual({ state: 'closed', consecutiveFailures: 0 });
  });

  it('keeps destinations independent', async () => {
    const redis = makeRedis();
    const breaker = new RedisWebhookCircuitBreakerService(redis, { failureThreshold: 1 });

    await breaker.recordTransportFailure('config-1');

    expect(await breaker.shouldAttempt('config-1')).toBe(false);
    expect(await breaker.shouldAttempt('config-2')).toBe(true);
  });

  it('lets delivery through when Redis is unreachable', async () => {
    const redis = makeRedis();
    redis.get = vi.fn(async () => {
      throw new Error('redis unavailable');
    });
    const breaker = new RedisWebhookCircuitBreakerService(redis, { failureThreshold: 1 });

    // O breaker protege contra lentidao; ele nao pode virar pre-requisito para
    // entregar. Sem estado legivel, tenta.
    expect(await breaker.shouldAttempt('config-1')).toBe(true);
  });
});
