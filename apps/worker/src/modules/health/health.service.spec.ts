import { ConfigService } from '@nestjs/config';
import { WorkerHealthService } from './health.service';
import { PrismaService } from '../../infra/database/prisma.service';

describe('WorkerHealthService', () => {
  const config = {
    get: jest.fn(),
  } as unknown as ConfigService;

  function makeService(options?: {
    databaseError?: Error;
    redisError?: Error;
  }): WorkerHealthService {
    const prisma = {
      $queryRaw: jest.fn().mockImplementation(() => {
        if (options?.databaseError) {
          return Promise.reject(options.databaseError);
        }
        return Promise.resolve([{ value: 1 }]);
      }),
    } as unknown as PrismaService;
    const redis = {
      ping: jest.fn().mockImplementation(() => {
        if (options?.redisError) {
          return Promise.reject(options.redisError);
        }
        return Promise.resolve('PONG');
      }),
      quit: jest.fn(),
    };

    return new WorkerHealthService(prisma, config, redis);
  }

  it('returns ok when database and Redis are reachable', async () => {
    await expect(makeService().readiness()).resolves.toEqual({
      status: 'ok',
      checks: {
        database: { status: 'ok' },
        redis: { status: 'ok' },
      },
    });
  });

  it('identifies database failures', async () => {
    await expect(
      makeService({
        databaseError: new Error('database unavailable'),
      }).readiness(),
    ).rejects.toMatchObject({
      response: {
        status: 'error',
        checks: {
          database: {
            status: 'error',
            message: 'database unavailable',
          },
          redis: { status: 'ok' },
        },
      },
    });
  });

  it('identifies Redis failures', async () => {
    await expect(
      makeService({ redisError: new Error('redis unavailable') }).readiness(),
    ).rejects.toMatchObject({
      response: {
        status: 'error',
        checks: {
          database: { status: 'ok' },
          redis: {
            status: 'error',
            message: 'redis unavailable',
          },
        },
      },
    });
  });
});
