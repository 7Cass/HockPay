import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRequeueOptions,
  buildWebhookResetForRequeue,
  guardExistingTargetJob,
  requeueDlqJob,
} from './dlq-helpers.mjs';

describe('buildRequeueOptions', () => {
  it('builds webhook delivery defaults from the payload event id', () => {
    assert.deepEqual(
      buildRequeueOptions({
        originalQueue: 'webhook-delivery',
        originalJobId: 'job-1',
        payload: { eventId: 'outbox-1' },
      }),
      {
        delay: 0,
        jobId: 'webhook-outbox-1',
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
        removeOnComplete: {
          count: 1000,
          age: 24 * 60 * 60,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60,
        },
      },
    );
  });

  it('builds alert delivery defaults from the payload event id', () => {
    const options = buildRequeueOptions({
      originalQueue: 'alert-delivery',
      originalJobId: 'job-1',
      payload: { eventId: 'outbox-1' },
    });

    assert.equal(options.jobId, 'alert-outbox-1');
    assert.equal(options.attempts, 5);
    assert.deepEqual(options.backoff, {
      type: 'exponential',
      delay: 60000,
    });
  });

  it('uses the original job id for unknown queues', () => {
    assert.deepEqual(
      buildRequeueOptions({
        originalQueue: 'custom-queue',
        originalJobId: 'job-1',
        payload: {},
      }),
      {
        delay: 0,
        jobId: 'job-1',
      },
    );
  });

  it('allows safe original option overrides', () => {
    assert.deepEqual(
      buildRequeueOptions({
        originalQueue: 'webhook-delivery',
        originalJobId: 'job-1',
        payload: { eventId: 'outbox-1' },
        originalJobOptions: {
          attempts: 9,
          backoff: { type: 'fixed', delay: 10 },
          delay: 30,
          jobId: 'manual-job',
          removeOnComplete: false,
          removeOnFail: { count: 10 },
          stackTraceLimit: 100,
        },
      }),
      {
        delay: 30,
        jobId: 'manual-job',
        attempts: 9,
        backoff: { type: 'fixed', delay: 10 },
        removeOnComplete: false,
        removeOnFail: { count: 10 },
      },
    );
  });
});

describe('guardExistingTargetJob', () => {
  it('blocks an existing target job without force', async () => {
    const target = {
      getJob: async () => ({
        getState: async () => 'waiting',
      }),
    };

    await assert.rejects(
      guardExistingTargetJob({
        target,
        originalQueue: 'webhook-delivery',
        jobId: 'webhook-outbox-1',
      }),
      /Use --force to bypass this guard/,
    );
  });

  it('bypasses the existing target job guard with force', async () => {
    let getJobCalls = 0;
    const target = {
      getJob: async () => {
        getJobCalls++;
        return {
          getState: async () => 'waiting',
        };
      },
    };

    await guardExistingTargetJob({
      target,
      originalQueue: 'webhook-delivery',
      jobId: 'webhook-outbox-1',
      force: true,
    });

    assert.equal(getJobCalls, 0);
  });
});

describe('requeueDlqJob', () => {
  it('runs reset before enqueue', async () => {
    const calls = [];
    const dlq = {
      name: 'webhook-dead-letter',
      getJob: async () => ({
        data: {
          originalQueue: 'webhook-delivery',
          originalJobName: 'deliver',
          originalJobId: 'job-1',
          payload: { eventId: 'outbox-1' },
        },
      }),
    };
    const target = {
      getJob: async () => undefined,
      add: async () => {
        calls.push('enqueue');
        return { id: 'webhook-outbox-1' };
      },
      close: async () => undefined,
    };

    await requeueDlqJob({
      dlq,
      id: 'dlq-1',
      createQueue: () => target,
      beforeEnqueue: async () => {
        calls.push('reset');
      },
      logger: () => undefined,
    });

    assert.deepEqual(calls, ['reset', 'enqueue']);
  });
});

describe('buildWebhookResetForRequeue', () => {
  it('builds a filtered webhook reset plan when configIds are present', () => {
    assert.deepEqual(
      buildWebhookResetForRequeue('webhook-dead-letter', {
        originalQueue: 'webhook-delivery',
        outboxEventId: 'outbox-1',
        configIds: ['config-1', 'config-1', 'config-2'],
        payload: { eventId: 'payload-event' },
      }),
      {
        outboxEventId: 'outbox-1',
        configIds: ['config-1', 'config-2'],
      },
    );
  });

  it('uses legacy all-config reset when configIds are absent', () => {
    assert.deepEqual(
      buildWebhookResetForRequeue('webhook-dead-letter', {
        originalQueue: 'webhook-delivery',
        configId: 'legacy-config',
        payload: { eventId: 'outbox-1' },
      }),
      {
        outboxEventId: 'outbox-1',
      },
    );
  });

  it('does not build reset plans for alert DLQ jobs', () => {
    assert.equal(
      buildWebhookResetForRequeue('alert-dead-letter', {
        originalQueue: 'alert-delivery',
        outboxEventId: 'outbox-1',
        payload: { eventId: 'outbox-1' },
      }),
      undefined,
    );
  });
});
