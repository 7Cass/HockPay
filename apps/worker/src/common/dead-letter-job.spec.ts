import {
  buildDeadLetterJobData,
  isFinalBullMqFailure,
} from './dead-letter-job';

describe('dead-letter-job helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('detects only final BullMQ failures', () => {
    expect(isFinalBullMqFailure({ attemptsMade: 4, opts: { attempts: 5 } } as any)).toBe(false);
    expect(isFinalBullMqFailure({ attemptsMade: 5, opts: { attempts: 5 } } as any)).toBe(true);
    expect(isFinalBullMqFailure({ attemptsMade: 1, opts: {} } as any)).toBe(true);
  });

  it('builds the required DLQ payload fields from the original job', () => {
    const data = buildDeadLetterJobData(
      'webhook-delivery',
      {
        id: 'job-1',
        name: 'deliver',
        data: {
          eventId: 'outbox-1',
          requestId: 'req-1',
          other: true,
        },
        attemptsMade: 5,
        failedReason: 'previous reason',
      } as any,
      new Error('final failure'),
    );

    expect(data).toEqual({
      originalQueue: 'webhook-delivery',
      originalJobId: 'job-1',
      originalJobName: 'deliver',
      payload: {
        eventId: 'outbox-1',
        requestId: 'req-1',
        other: true,
      },
      attemptsMade: 5,
      failedReason: 'final failure',
      requestId: 'req-1',
      outboxEventId: 'outbox-1',
      timestamp: '2026-05-16T12:00:00.000Z',
    });
  });
});
