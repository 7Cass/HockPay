import { AlertProcessor } from './alert.processor';

describe('AlertProcessor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('moves an alert job to the DLQ on final BullMQ failure', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
    const deadLetterQueue = { add: jest.fn().mockResolvedValue(undefined) };
    const processor = new AlertProcessor({ execute: jest.fn() } as any, deadLetterQueue as any);
    const job = {
      id: 'job-1',
      name: 'deliver',
      data: { eventId: 'outbox-1' },
      attemptsMade: 5,
      opts: { attempts: 5 },
      failedReason: 'previous failure',
    };

    await processor.onFailed(job as any, new Error('alert failed'));

    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      'dead-letter',
      {
        originalQueue: 'alert-delivery',
        originalJobId: 'job-1',
        originalJobName: 'deliver',
        payload: { eventId: 'outbox-1' },
        attemptsMade: 5,
        failedReason: 'alert failed',
        outboxEventId: 'outbox-1',
        timestamp: '2026-05-16T12:00:00.000Z',
      },
      { jobId: 'alert-delivery:job-1' },
    );
  });
});
