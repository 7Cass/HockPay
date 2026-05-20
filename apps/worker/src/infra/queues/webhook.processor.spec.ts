import { WebhookProcessor } from './webhook.processor';

describe('WebhookProcessor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('moves a webhook job to the DLQ on final BullMQ failure', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
    const useCase = { execute: jest.fn() };
    const event = {
      isProcessed: jest.fn().mockReturnValue(false),
      markAsTerminalFailed: jest.fn(),
    };
    const outboxRepository = {
      findById: jest.fn().mockResolvedValue(event),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const webhookLogRepository = {
      findByOutboxEventId: jest.fn().mockResolvedValue([
        {
          configId: 'config-1',
          isDelivered: jest.fn().mockReturnValue(false),
        },
      ]),
      markOutboxDeliveriesFinalFailure: jest.fn().mockResolvedValue(1),
    };
    const deadLetterQueue = { add: jest.fn().mockResolvedValue(undefined) };
    const processor = new WebhookProcessor(
      useCase as any,
      outboxRepository as any,
      webhookLogRepository as any,
      deadLetterQueue as any,
    );
    const job = {
      id: 'job-1',
      name: 'deliver',
      data: { eventId: 'outbox-1', attempt: 1, requestId: 'req-1' },
      attemptsMade: 5,
      opts: { attempts: 5 },
      failedReason: 'previous failure',
    };

    await processor.onFailed(job as any, new Error('delivery failed'));

    expect(webhookLogRepository.findByOutboxEventId).toHaveBeenCalledWith(
      'outbox-1',
    );
    expect(webhookLogRepository.markOutboxDeliveriesFinalFailure).toHaveBeenCalledWith(
      'outbox-1',
      'delivery failed',
      5,
    );
    expect(outboxRepository.findById).toHaveBeenCalledWith('outbox-1');
    expect(event.markAsTerminalFailed).toHaveBeenCalledWith('delivery failed');
    expect(outboxRepository.update).toHaveBeenCalledWith(event);
    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      'dead-letter',
      {
        originalQueue: 'webhook-delivery',
        originalJobId: 'job-1',
        originalJobName: 'deliver',
        originalJobOptions: {
          attempts: 5,
          jobId: 'job-1',
        },
        payload: { eventId: 'outbox-1', attempt: 1, requestId: 'req-1' },
        attemptsMade: 5,
        failedReason: 'delivery failed',
        requestId: 'req-1',
        outboxEventId: 'outbox-1',
        configId: 'config-1',
        configIds: ['config-1'],
        timestamp: '2026-05-16T12:00:00.000Z',
      },
      { jobId: 'webhook-delivery:job-1' },
    );
    expect(
      webhookLogRepository.markOutboxDeliveriesFinalFailure.mock.invocationCallOrder[0],
    ).toBeLessThan(deadLetterQueue.add.mock.invocationCallOrder[0]);
  });

  it('does not move retryable webhook failures to the DLQ', async () => {
    const deadLetterQueue = { add: jest.fn() };
    const outboxRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };
    const webhookLogRepository = {
      findByOutboxEventId: jest.fn(),
      markOutboxDeliveriesFinalFailure: jest.fn(),
    };
    const processor = new WebhookProcessor(
      { execute: jest.fn() } as any,
      outboxRepository as any,
      webhookLogRepository as any,
      deadLetterQueue as any,
    );

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
    expect(webhookLogRepository.findByOutboxEventId).not.toHaveBeenCalled();
    expect(webhookLogRepository.markOutboxDeliveriesFinalFailure).not.toHaveBeenCalled();
    expect(outboxRepository.update).not.toHaveBeenCalled();
  });
});
