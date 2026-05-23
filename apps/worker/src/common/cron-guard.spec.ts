import { runExclusiveCronJob } from './cron-guard';

describe('runExclusiveCronJob', () => {
  it('skips a job while a previous run is still active', async () => {
    const logger = { warn: jest.fn() };
    let release!: () => void;
    const firstRun = runExclusiveCronJob(
      'job-a',
      logger,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    await runExclusiveCronJob('job-a', logger, jest.fn());

    expect(logger.warn).toHaveBeenCalledWith('Skipping job-a; previous run still active');

    release();
    await firstRun;
  });

  it('releases the guard when the job fails', async () => {
    const logger = { warn: jest.fn() };
    const error = new Error('boom');

    await expect(
      runExclusiveCronJob('job-b', logger, async () => {
        throw error;
      }),
    ).rejects.toThrow(error);

    const task = jest.fn().mockResolvedValue(undefined);
    await runExclusiveCronJob('job-b', logger, task);

    expect(task).toHaveBeenCalledTimes(1);
  });
});
