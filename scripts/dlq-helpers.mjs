export function buildRequeueOptions(data) {
  return {
    ...defaultJobOptionsFor(data),
    ...sanitizeJobOptions(data.originalJobOptions),
  };
}

export async function requeueDlqJob({
  dlq,
  id,
  createQueue,
  force = false,
  remove = false,
  beforeEnqueue,
  logger = console.log,
}) {
  const job = await dlq.getJob(id);
  if (!job) {
    throw new Error(`DLQ job ${id} was not found in ${dlq.name}`);
  }

  const data = job.data ?? {};
  if (!data.originalQueue || !data.payload) {
    throw new Error(`DLQ job ${id} does not contain originalQueue and payload`);
  }

  const target = createQueue(data.originalQueue);
  try {
    const options = buildRequeueOptions(data);
    await guardExistingTargetJob({
      target,
      originalQueue: data.originalQueue,
      jobId: options.jobId,
      force,
    });

    await beforeEnqueue?.({ data, dlqName: dlq.name, target, options });

    const requeued = await target.add(
      data.originalJobName ?? 'deliver',
      data.payload,
      options,
    );
    logger(
      `[dlq] requeued ${dlq.name}/${id} to ${data.originalQueue}/${requeued.id}`,
    );

    if (remove) {
      await job.remove();
      logger(`[dlq] removed ${dlq.name}/${id}`);
    }

    return requeued;
  } finally {
    await target.close();
  }
}

export async function guardExistingTargetJob({
  target,
  originalQueue,
  jobId,
  force = false,
}) {
  if (!jobId || force) {
    return;
  }

  const existing = await target.getJob(jobId);
  if (!existing) {
    return;
  }

  const state = await existing.getState();
  throw new Error(
    `Target job ${originalQueue}/${jobId} already exists with state ${state}. Use --force to bypass this guard.`,
  );
}

export function buildWebhookResetForRequeue(dlqName, data) {
  if (
    dlqName !== 'webhook-dead-letter' ||
    data.originalQueue !== 'webhook-delivery'
  ) {
    return undefined;
  }

  const outboxEventId = readOutboxEventId(data);
  if (!outboxEventId) {
    return undefined;
  }

  const configIds = normalizeConfigIds(data.configIds);
  return {
    outboxEventId,
    ...(configIds.length > 0 ? { configIds } : {}),
  };
}

export function formatConfigIds(data) {
  if (Array.isArray(data.configIds) && data.configIds.length > 0) {
    return data.configIds.join(',');
  }

  return data.configId ?? 'unknown';
}

function defaultJobOptionsFor(data) {
  if (data.originalQueue === 'webhook-delivery') {
    const eventId = readEventId(data.payload);
    return defaultDeliveryJobOptions(
      eventId ? `webhook-${eventId}` : data.originalJobId,
    );
  }

  if (data.originalQueue === 'alert-delivery') {
    const eventId = readEventId(data.payload);
    return defaultDeliveryJobOptions(
      eventId ? `alert-${eventId}` : data.originalJobId,
    );
  }

  return {
    delay: 0,
    ...(data.originalJobId ? { jobId: data.originalJobId } : {}),
  };
}

function defaultDeliveryJobOptions(jobId) {
  return {
    delay: 0,
    ...(jobId ? { jobId } : {}),
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

function readOutboxEventId(data) {
  if (typeof data.outboxEventId === 'string') {
    return data.outboxEventId;
  }

  return readEventId(data.payload);
}

function normalizeConfigIds(configIds) {
  if (!Array.isArray(configIds)) {
    return [];
  }

  return [
    ...new Set(
      configIds.filter((id) => typeof id === 'string' && id.length > 0),
    ),
  ];
}
