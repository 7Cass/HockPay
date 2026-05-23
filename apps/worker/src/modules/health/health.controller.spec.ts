import { HealthController } from './health.controller';
import { WorkerHealthService } from './health.service';

describe('HealthController', () => {
  it('returns liveness without dependency checks', () => {
    const readiness = jest.fn();
    const service = {
      readiness,
    } as unknown as WorkerHealthService;
    const controller = new HealthController(service);

    expect(controller.liveness()).toEqual({ status: 'ok' });
    expect(readiness).not.toHaveBeenCalled();
  });

  it('delegates readiness checks to the health service', async () => {
    const ready = {
      status: 'ok',
      checks: {
        database: { status: 'ok' },
        redis: { status: 'ok' },
      },
    };
    const readiness = jest.fn().mockResolvedValue(ready);
    const service = {
      readiness,
    } as unknown as WorkerHealthService;
    const controller = new HealthController(service);

    await expect(controller.readiness()).resolves.toEqual(ready);
    expect(readiness).toHaveBeenCalledTimes(1);
  });
});
