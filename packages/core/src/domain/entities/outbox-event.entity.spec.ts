import { describe, expect, it } from 'vitest';
import { OutboxEvent, OutboxEventStatus } from './outbox-event.entity';

describe('OutboxEvent', () => {
  it('marks a dispatched event with a retry watchdog and clears previous errors', () => {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      payload: { id: 'payment-1' },
    });
    const retryAt = new Date('2026-01-01T00:45:00.000Z');

    event.markAsFailed('queue unavailable');
    event.markAsDispatched(retryAt);

    expect(event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(event.nextRetryAt).toBe(retryAt);
    expect(event.errorMessage).toBeUndefined();
  });

  it('marks a failed event with retry metadata', () => {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      payload: { id: 'payment-1' },
    });
    const retryAt = new Date('2026-01-01T00:01:00.000Z');

    event.markAsFailed('Failed to insert webhook job into BullMQ', retryAt);

    expect(event.status).toBe(OutboxEventStatus.FAILED);
    expect(event.retryCount).toBe(1);
    expect(event.nextRetryAt).toBe(retryAt);
    expect(event.errorMessage).toBe('Failed to insert webhook job into BullMQ');
  });

  it('marks a terminally failed event as non-retryable', () => {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      payload: { id: 'payment-1' },
    });

    event.markAsTerminalFailed('BullMQ attempts exhausted');

    expect(event.status).toBe(OutboxEventStatus.FAILED);
    expect(event.retryCount).toBe(event.maxRetries);
    expect(event.nextRetryAt).toBeUndefined();
    expect(event.errorMessage).toBe('BullMQ attempts exhausted');
    expect(event.canRetry()).toBe(false);
  });

  it('clears retry metadata when processed', () => {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      payload: { id: 'payment-1' },
    });

    event.markAsFailed('temporary failure', new Date());
    event.markAsProcessed();

    expect(event.status).toBe(OutboxEventStatus.PROCESSED);
    expect(event.nextRetryAt).toBeUndefined();
    expect(event.errorMessage).toBeUndefined();
  });

  it('resets to a requeueable state', () => {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      payload: { id: 'payment-1' },
    });
    const watchdogUntil = new Date('2026-01-01T00:45:00.000Z');

    event.markAsFailed('temporary failure', new Date('2026-01-01T00:00:00.000Z'));
    event.resetForRequeue(watchdogUntil);

    expect(event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(event.retryCount).toBe(0);
    expect(event.nextRetryAt).toBe(watchdogUntil);
    expect(event.errorMessage).toBeUndefined();
    expect(event.processedAt).toBeUndefined();
  });

  it('adds an explicit top-level storeId to the payload when provided', () => {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      storeId: 'store-1',
      payload: {
        id: 'payment-1',
        storeId: 'stale-store',
      },
    });

    expect(event.payload).toMatchObject({
      id: 'payment-1',
      storeId: 'store-1',
    });
  });

  it('preserves the request id for async traceability', () => {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      requestId: 'req-1',
      payload: { id: 'payment-1' },
    });

    expect(event.requestId).toBe('req-1');
    expect(event.toObject().requestId).toBe('req-1');
  });
});
