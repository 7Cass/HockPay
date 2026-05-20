import { Job } from 'bullmq';

export interface WorkerDeadLetterJobData {
  originalQueue: string;
  originalJobId: string;
  originalJobName: string;
  originalJobOptions?: WorkerDeadLetterJobOptions;
  payload: Record<string, unknown>;
  attemptsMade: number;
  failedReason: string;
  requestId?: string;
  outboxEventId?: string;
  configId?: string;
  configIds?: string[];
  timestamp: string;
}

export interface WorkerDeadLetterJobOptions {
  attempts?: number;
  backoff?: unknown;
  delay?: number;
  jobId?: string;
  removeOnComplete?: unknown;
  removeOnFail?: unknown;
}

export function isFinalBullMqFailure(job: Pick<Job, 'attemptsMade' | 'opts'>): boolean {
  const maxAttempts = job.opts.attempts ?? 1;
  return job.attemptsMade >= maxAttempts;
}

export function buildDeadLetterJobData(
  originalQueue: string,
  job: Pick<Job, 'id' | 'name' | 'data' | 'attemptsMade' | 'failedReason' | 'opts'>,
  error: Error,
): WorkerDeadLetterJobData {
  const payload = normalizePayload(job.data);
  const requestId =
    typeof payload.requestId === 'string' ? payload.requestId : undefined;
  const outboxEventId =
    typeof payload.outboxEventId === 'string'
      ? payload.outboxEventId
      : typeof payload.eventId === 'string'
        ? payload.eventId
        : undefined;
  const configId =
    typeof payload.configId === 'string' ? payload.configId : undefined;

  return {
    originalQueue,
    originalJobId: String(job.id),
    originalJobName: job.name,
    originalJobOptions: normalizeJobOptions(job),
    payload,
    attemptsMade: job.attemptsMade,
    failedReason: error.message || job.failedReason || 'unknown',
    ...(requestId ? { requestId } : {}),
    ...(outboxEventId ? { outboxEventId } : {}),
    ...(configId ? { configId, configIds: [configId] } : {}),
    timestamp: new Date().toISOString(),
  };
}

function normalizeJobOptions(
  job: Pick<Job, 'id' | 'opts'>,
): WorkerDeadLetterJobOptions | undefined {
  const options: WorkerDeadLetterJobOptions = {};

  if (job.opts.attempts !== undefined) {
    options.attempts = job.opts.attempts;
  }

  if (job.opts.backoff !== undefined) {
    options.backoff = job.opts.backoff;
  }

  if (job.opts.delay !== undefined) {
    options.delay = job.opts.delay;
  }

  options.jobId =
    typeof job.opts.jobId === 'string' ? job.opts.jobId : String(job.id);

  if (job.opts.removeOnComplete !== undefined) {
    options.removeOnComplete = job.opts.removeOnComplete;
  }

  if (job.opts.removeOnFail !== undefined) {
    options.removeOnFail = job.opts.removeOnFail;
  }

  return Object.keys(options).length > 0 ? options : undefined;
}

function normalizePayload(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }

  return { value: payload };
}
