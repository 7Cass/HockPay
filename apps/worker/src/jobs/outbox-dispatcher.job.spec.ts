import { OutboxEvent, OutboxEventStatus } from '@hockpay/core';
import { OutboxDispatcherJob } from './outbox-dispatcher.job';

describe('OutboxDispatcherJob', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function createEvent(): OutboxEvent {
    return OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      payload: { id: 'payment-1', storeId: 'store-1' },
    });
  }

  it('claims events before enqueueing and does not update on success', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const event = createEvent();
    const calls: string[] = [];
    const outboxRepository = {
      claimDispatchableEvents: jest.fn().mockImplementation(async ({ watchdogUntil }) => {
        calls.push('outbox.claim');
        event.markAsDispatched(watchdogUntil);
        return [event];
      }),
      update: jest.fn().mockImplementation(async (updated: OutboxEvent) => {
        calls.push(`outbox.update:${updated.status}`);
      }),
    };
    const webhookQueue = {
      enqueue: jest.fn().mockImplementation(async () => {
        calls.push('webhook.enqueue');
      }),
    };
    const alertQueue = {
      enqueue: jest.fn().mockImplementation(async () => {
        calls.push('alert.enqueue');
      }),
    };
    const job = new OutboxDispatcherJob(
      outboxRepository as any,
      webhookQueue as any,
      alertQueue as any,
    );

    await job.handleDispatch();

    expect(outboxRepository.claimDispatchableEvents).toHaveBeenCalledWith({
      limit: 50,
      watchdogUntil: new Date('2026-01-01T00:45:00.000Z'),
    });
    expect(calls).toEqual(['outbox.claim', 'webhook.enqueue', 'alert.enqueue']);
    expect(outboxRepository.update).not.toHaveBeenCalled();
    expect(event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(event.nextRetryAt).toEqual(new Date('2026-01-01T00:45:00.000Z'));
  });

  it('marks the event as failed with retry metadata when webhook enqueue fails', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const event = createEvent();
    event.markAsDispatched(new Date('2026-01-01T00:45:00.000Z'));
    const outboxRepository = {
      claimDispatchableEvents: jest.fn().mockResolvedValue([event]),
      update: jest.fn(),
    };
    const webhookQueue = {
      enqueue: jest.fn().mockRejectedValue(new Error('redis down')),
    };
    const alertQueue = {
      enqueue: jest.fn(),
    };
    const job = new OutboxDispatcherJob(
      outboxRepository as any,
      webhookQueue as any,
      alertQueue as any,
    );

    await job.handleDispatch();

    expect(alertQueue.enqueue).not.toHaveBeenCalled();
    expect(outboxRepository.update).toHaveBeenCalledTimes(1);
    expect(event.status).toBe(OutboxEventStatus.FAILED);
    expect(event.retryCount).toBe(1);
    expect(event.nextRetryAt).toEqual(new Date('2026-01-01T00:01:00.000Z'));
  });

  it('keeps webhook dispatch successful when alert enqueue fails', async () => {
    const event = createEvent();
    event.markAsDispatched(new Date('2026-01-01T00:45:00.000Z'));
    const outboxRepository = {
      claimDispatchableEvents: jest.fn().mockResolvedValue([event]),
      update: jest.fn(),
    };
    const webhookQueue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };
    const alertQueue = {
      enqueue: jest.fn().mockRejectedValue(new Error('alert queue down')),
    };
    const job = new OutboxDispatcherJob(
      outboxRepository as any,
      webhookQueue as any,
      alertQueue as any,
    );

    await job.handleDispatch();

    expect(webhookQueue.enqueue).toHaveBeenCalledWith(event.id, undefined, expect.any(String));
    expect(alertQueue.enqueue).toHaveBeenCalledWith(event.id, undefined, expect.any(String));
    expect(outboxRepository.update).not.toHaveBeenCalled();
    expect(event.status).toBe(OutboxEventStatus.DISPATCHED);
  });

  it('logs dispatched outbox and payment identifiers', async () => {
    const event = createEvent();
    const logger = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const outboxRepository = {
      claimDispatchableEvents: jest.fn().mockResolvedValue([event]),
      update: jest.fn(),
    };
    const webhookQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const alertQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const job = new OutboxDispatcherJob(
      outboxRepository as any,
      webhookQueue as any,
      alertQueue as any,
    );
    (job as any).logger = logger;

    await job.handleDispatch();

    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`outboxEventId=${event.id}`));
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('paymentId=payment-1'));
  });
});
