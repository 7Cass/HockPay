import { Queue } from 'bullmq';

const QUEUE_ALIASES = {
  webhook: 'webhook-dead-letter',
  alert: 'alert-dead-letter',
  'webhook-dead-letter': 'webhook-dead-letter',
  'alert-dead-letter': 'alert-dead-letter',
};

const command = process.argv[2];
const queueArg = process.argv[3];
const jobId = process.argv[4];

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

main().catch((error) => {
  console.error(`[dlq] ${formatError(error)}`);
  process.exitCode = 1;
});

async function main() {
  if (!command || !queueArg) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const queueName = resolveQueueName(queueArg);
  const dlq = new Queue(queueName, { connection });

  try {
    if (command === 'list') {
      await listJobs(dlq);
      return;
    }

    if (command === 'show') {
      requireJobId();
      await showJob(dlq, jobId);
      return;
    }

    if (command === 'requeue') {
      requireJobId();
      await requeueJob(dlq, jobId);
      return;
    }

    printUsage();
    process.exitCode = 1;
  } finally {
    await dlq.close();
  }
}

async function listJobs(dlq) {
  const limit = readNumberFlag('--limit', 20);
  const jobs = await dlq.getJobs(
    ['waiting', 'delayed', 'paused', 'failed'],
    0,
    limit - 1,
    false,
  );

  if (jobs.length === 0) {
    console.log(`[dlq] ${dlq.name} is empty`);
    return;
  }

  for (const job of jobs) {
    const data = job.data ?? {};
    console.log(
      [
        `id=${job.id}`,
        `originalQueue=${data.originalQueue ?? 'unknown'}`,
        `originalJobId=${data.originalJobId ?? 'unknown'}`,
        `outboxEventId=${data.outboxEventId ?? 'unknown'}`,
        `configIds=${formatConfigIds(data)}`,
        `requestId=${data.requestId ?? 'unknown'}`,
        `attemptsMade=${data.attemptsMade ?? 'unknown'}`,
        `timestamp=${data.timestamp ?? 'unknown'}`,
        `failedReason=${data.failedReason ?? 'unknown'}`,
      ].join(' '),
    );
  }
}

async function showJob(dlq, id) {
  const job = await dlq.getJob(id);
  if (!job) {
    throw new Error(`DLQ job ${id} was not found in ${dlq.name}`);
  }

  console.log(JSON.stringify({ id: job.id, name: job.name, data: job.data }, null, 2));
}

async function requeueJob(dlq, id) {
  const job = await dlq.getJob(id);
  if (!job) {
    throw new Error(`DLQ job ${id} was not found in ${dlq.name}`);
  }

  const data = job.data ?? {};
  if (!data.originalQueue || !data.payload) {
    throw new Error(`DLQ job ${id} does not contain originalQueue and payload`);
  }

  const target = new Queue(data.originalQueue, { connection });
  try {
    const options = buildRequeueOptions(data);
    if (options.jobId && !hasFlag('--force')) {
      const existing = await target.getJob(options.jobId);
      if (existing) {
        const state = await existing.getState();
        throw new Error(
          `Target job ${data.originalQueue}/${options.jobId} already exists with state ${state}. Use --force to bypass this guard.`,
        );
      }
    }

    const requeued = await target.add(
      data.originalJobName ?? 'deliver',
      data.payload,
      options,
    );
    console.log(
      `[dlq] requeued ${dlq.name}/${id} to ${data.originalQueue}/${requeued.id}`,
    );

    if (hasFlag('--remove')) {
      await job.remove();
      console.log(`[dlq] removed ${dlq.name}/${id}`);
    }
  } finally {
    await target.close();
  }
}

function buildRequeueOptions(data) {
  return {
    ...defaultJobOptionsFor(data),
    ...sanitizeJobOptions(data.originalJobOptions),
  };
}

function defaultJobOptionsFor(data) {
  if (data.originalQueue === 'webhook-delivery') {
    const eventId = readEventId(data.payload);
    return {
      delay: 0,
      jobId: eventId ? `webhook-${eventId}` : data.originalJobId,
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
    };
  }

  if (data.originalQueue === 'alert-delivery') {
    const eventId = readEventId(data.payload);
    return {
      delay: 0,
      jobId: eventId ? `alert-${eventId}` : data.originalJobId,
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
    };
  }

  return {
    delay: 0,
    ...(data.originalJobId ? { jobId: data.originalJobId } : {}),
  };
}

function sanitizeJobOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return {};
  }

  const sanitized = {};
  for (const key of [
    'attempts',
    'backoff',
    'delay',
    'jobId',
    'removeOnComplete',
    'removeOnFail',
  ]) {
    if (options[key] !== undefined) {
      sanitized[key] = options[key];
    }
  }

  return sanitized;
}

function readEventId(payload) {
  return payload && typeof payload.eventId === 'string' ? payload.eventId : undefined;
}

function formatConfigIds(data) {
  if (Array.isArray(data.configIds) && data.configIds.length > 0) {
    return data.configIds.join(',');
  }

  return data.configId ?? 'unknown';
}

function resolveQueueName(value) {
  const queueName = QUEUE_ALIASES[value];
  if (!queueName) {
    throw new Error(
      `Unknown DLQ "${value}". Use webhook, alert, webhook-dead-letter, or alert-dead-letter.`,
    );
  }
  return queueName;
}

function requireJobId() {
  if (!jobId) {
    throw new Error(`${command} requires a DLQ job id`);
  }
}

function readNumberFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;

  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function printUsage() {
  console.log(`Usage:
  node scripts/dlq.mjs list <webhook|alert> [--limit 20]
  node scripts/dlq.mjs show <webhook|alert> <dlqJobId>
  node scripts/dlq.mjs requeue <webhook|alert> <dlqJobId> [--remove] [--force]

Environment:
  REDIS_HOST=localhost REDIS_PORT=6379`);
}
