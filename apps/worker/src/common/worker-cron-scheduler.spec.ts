import { ConfigService } from '@nestjs/config';
import { WorkerCronScheduler } from './worker-cron-scheduler';

describe('WorkerCronScheduler', () => {
  function makeScheduler(env: Record<string, string | undefined> = {}) {
    const registry = {
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
    };
    const config = {
      get: jest.fn((name: string) => env[name]),
    };

    return {
      scheduler: new WorkerCronScheduler(
        registry as any,
        config as unknown as ConfigService,
      ),
      registry,
      config,
    };
  }

  function makeSchedulerWithLock(
    env: Record<string, string | undefined> = {},
    distributedLock = {
      tryAcquire: jest.fn(),
      release: jest.fn(),
    },
  ) {
    const registry = {
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
    };
    const config = {
      get: jest.fn((name: string) => env[name]),
    };

    return {
      scheduler: new WorkerCronScheduler(
        registry as any,
        config as unknown as ConfigService,
        distributedLock as any,
      ),
      distributedLock,
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a cron job with the default expression when env is absent', () => {
    const { scheduler, registry } = makeScheduler();

    scheduler.registerCronJob({
      name: 'test-job',
      envName: 'WORKER_CRON_TEST',
      defaultExpression: '*/10 * * * * *',
      onTick: jest.fn(),
    });

    expect(registry.addCronJob).toHaveBeenCalledTimes(1);
    expect(registry.addCronJob).toHaveBeenCalledWith(
      'test-job',
      expect.objectContaining({}),
    );

    const job = registry.addCronJob.mock.calls[0][1];
    job.stop();
  });

  it('registers a cron job with the env expression when present', () => {
    const { scheduler, registry } = makeScheduler({
      WORKER_CRON_TEST: '*/5 * * * * *',
    });

    scheduler.registerCronJob({
      name: 'test-job',
      envName: 'WORKER_CRON_TEST',
      defaultExpression: '*/10 * * * * *',
      onTick: jest.fn(),
    });

    const job = registry.addCronJob.mock.calls[0][1];
    expect(job.cronTime.source).toBe('*/5 * * * * *');
    job.stop();
  });

  it('fails startup when the env expression is invalid', () => {
    const { scheduler, registry } = makeScheduler({
      WORKER_CRON_TEST: 'not-a-cron',
    });

    expect(() =>
      scheduler.registerCronJob({
        name: 'test-job',
        envName: 'WORKER_CRON_TEST',
        defaultExpression: '*/10 * * * * *',
        onTick: jest.fn(),
      }),
    ).toThrow(
      'Invalid cron expression for WORKER_CRON_TEST (test-job): "not-a-cron"',
    );

    expect(registry.addCronJob).not.toHaveBeenCalled();
  });

  it('deletes registered cron jobs on module destroy', () => {
    const { scheduler, registry } = makeScheduler();

    scheduler.registerCronJob({
      name: 'test-job',
      envName: 'WORKER_CRON_TEST',
      defaultExpression: '*/10 * * * * *',
      onTick: jest.fn(),
    });

    const job = registry.addCronJob.mock.calls[0][1];
    scheduler.onModuleDestroy();

    expect(registry.deleteCronJob).toHaveBeenCalledWith('test-job');
    job.stop();
  });

  it('runs cron ticks under the Redis distributed lock', async () => {
    const distributedLock = {
      tryAcquire: jest.fn().mockResolvedValue({
        key: 'hockpay:worker:cron:test-job:lock',
        token: 'token-1',
      }),
      release: jest.fn().mockResolvedValue(true),
    };
    const { scheduler } = makeSchedulerWithLock(
      { WORKER_CRON_LOCK_TTL_MS: '30000' },
      distributedLock,
    );
    const onTick = jest.fn().mockResolvedValue(undefined);

    await (scheduler as any).runTick({
      name: 'test-job',
      envName: 'WORKER_CRON_TEST',
      defaultExpression: '*/10 * * * * *',
      onTick,
    });

    expect(distributedLock.tryAcquire).toHaveBeenCalledWith(
      'hockpay:worker:cron:test-job:lock',
      30000,
    );
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(distributedLock.release).toHaveBeenCalledWith({
      key: 'hockpay:worker:cron:test-job:lock',
      token: 'token-1',
    });
  });

  it('skips cron ticks when the distributed lock is held by another worker', async () => {
    const distributedLock = {
      tryAcquire: jest.fn().mockResolvedValue(null),
      release: jest.fn(),
    };
    const { scheduler } = makeSchedulerWithLock({}, distributedLock);
    const onTick = jest.fn();

    await (scheduler as any).runTick({
      name: 'test-job',
      envName: 'WORKER_CRON_TEST',
      defaultExpression: '*/10 * * * * *',
      onTick,
    });

    expect(onTick).not.toHaveBeenCalled();
    expect(distributedLock.release).not.toHaveBeenCalled();
  });
});
