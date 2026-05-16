import { WebhookProcessor } from './webhook.processor';

describe('WebhookProcessor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('moves a webhook job to the DLQ on final BullMQ failure', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
    const useCase = { execute: jest.fn() };
    const deadLetterQueue = { add: jest.fn().mockResolvedValue(undefined) };
    const processor = new WebhookProcessor(useCase as any, deadLetterQueue as any);
    const job = {
      id: 'job-1',
      name: 'deliver',
      data: { eventId: 'outbox-1', attempt: 1, requestId: 'req-1' },
      attemptsMade: 5,
      opts: { attempts: 5 },
      failedReason: 'previous failure',
    };

    await processor.onFailed(job as any, new Error('delivery failed'));

    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      'dead-letter',
      {
        originalQueue: 'webhook-delivery',
        originalJobId: 'job-1',
        originalJobName: 'deliver',
        payload: { eventId: 'outbox-1', attempt: 1, requestId: 'req-1' },
        attemptsMade: 5,
        failedReason: 'delivery failed',
        requestId: 'req-1',
        outboxEventId: 'outbox-1',
        timestamp: '2026-05-16T12:00:00.000Z',
      },
      { jobId: 'webhook-delivery:job-1' },
    );
  });

  it('does not move retryable webhook failures to the DLQ', async () => {
    const deadLetterQueue = { add: jest.fn() };
    const processor = new WebhookProcessor({ execute: jest.fn() } as any, deadLetterQueue as any);

    await processor.onFailed(
      {
        id: 'job-1',
        name: 'deliver',
        data: { eventId: 'outbox-1', attempt: 1 },
        attemptsMade: 2,
        opts: { attempts: 5 },
      } as any,
      new Error('delivery failed'),
    );

    expect(deadLetterQueue.add).not.toHaveBeenCalled();
  });
});
