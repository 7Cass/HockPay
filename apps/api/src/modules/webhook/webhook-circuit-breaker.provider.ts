import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  parseRedisEnv,
  RedisWebhookCircuitBreakerService,
  WebhookCircuitRedisClient,
} from '@hockpay/infrastructure';

export const WEBHOOK_CIRCUIT_BREAKER = 'WEBHOOK_CIRCUIT_BREAKER';

/**
 * A API le o estado do breaker; quem escreve e o worker, que e onde as entregas
 * acontecem. Mesmas chaves no mesmo Redis, entao os limiares nao precisam ser
 * repetidos aqui: `status()` so interpreta o que o worker gravou.
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
      lazyConnect: true,
    }) as unknown as WebhookCircuitRedisClient;

    return new RedisWebhookCircuitBreakerService(redis);
  },
  inject: [ConfigService],
};
