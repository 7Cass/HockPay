import {
  Inject,
  Injectable,
  OnModuleDestroy,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { parseRedisEnv } from '@hockpay/infrastructure';
import { PrismaService } from '../../infra/database/prisma.service';

export const WORKER_HEALTH_REDIS_CLIENT = 'WORKER_HEALTH_REDIS_CLIENT';

type DependencyStatus = 'ok' | 'error';

type RedisHealthClient = {
  ping(): Promise<string>;
  quit(): Promise<unknown>;
};

interface DependencyCheck {
  status: DependencyStatus;
  message?: string;
}

interface ReadinessResponse {
  status: DependencyStatus;
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
  };
}

@Injectable()
export class WorkerHealthService implements OnModuleDestroy {
  private readonly redis: RedisHealthClient;
  private readonly ownsRedisClient: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(WORKER_HEALTH_REDIS_CLIENT)
    redis?: RedisHealthClient,
  ) {
    this.redis =
      redis ??
      new Redis({
        ...parseRedisEnv({
          REDIS_URL: this.configService.get<string>('REDIS_URL'),
          REDIS_HOST: this.configService.get<string>('REDIS_HOST'),
          REDIS_PORT: this.configService.get<string>('REDIS_PORT'),
        }).connection,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    this.ownsRedisClient = !redis;
  }

  async readiness(): Promise<ReadinessResponse> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const response: ReadinessResponse = {
      status: database.status === 'ok' && redis.status === 'ok' ? 'ok' : 'error',
      checks: {
        database,
        redis,
      },
    };

    if (response.status === 'error') {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ownsRedisClient) {
      await this.redis.quit();
    }
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        message: this.errorMessage(error),
      };
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    try {
      await this.redis.ping();
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        message: this.errorMessage(error),
      };
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
