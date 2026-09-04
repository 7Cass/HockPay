import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  parseRedisEnv,
  RedisWebhookCircuitBreakerService,
  WebhookCircuitRedisClient,
} from '@hockpay/infrastructure';

export const WEBHOOK_CIRCUIT_BREAKER = 'WEBHOOK_CIRCUIT_BREAKER';

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_OPEN_MS = 60_000;

function positiveIntFromEnv(configService: ConfigService, name: string, fallback: number): number {
  const raw = configService.get<string>(name);
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    new Logger(WEBHOOK_CIRCUIT_BREAKER).warn(
      `${name}="${raw}" is not a positive integer; falling back to ${fallback}.`,
    );
    return fallback;
  }

  return parsed;
}

/**
 * O breaker compartilha o Redis operacional, mas com cliente proprio: um
 * `maxRetriesPerRequest` baixo garante que consultar o estado nunca custe mais
 * do que a entrega que ele deveria estar economizando.
 */
export const webhookCircuitBreakerProvider: Provider = {
  provide: WEBHOOK_CIRCUIT_BREAKER,
  useFactory: (configService: ConfigService) => {
    const redis = new Redis({
      ...parseRedisEnv({
        REDIS_URL: configService.get<string>('REDIS_URL'),
        REDIS_HOST: configService.get<string>('REDIS_HOST'),
        REDIS_PORT: configService.get<string>('REDIS_PORT'),
      }).connection,
      maxRetriesPerRequest: 1,
    }) as unknown as WebhookCircuitRedisClient;

    return new RedisWebhookCircuitBreakerService(redis, {
      failureThreshold: positiveIntFromEnv(
        configService,
        'WEBHOOK_CIRCUIT_FAILURE_THRESHOLD',
        DEFAULT_FAILURE_THRESHOLD,
      ),
      openMs: positiveIntFromEnv(configService, 'WEBHOOK_CIRCUIT_OPEN_MS', DEFAULT_OPEN_MS),
    });
  },
  inject: [ConfigService],
};
