import { Job } from 'bullmq';

export interface WorkerDeadLetterJobData {
  originalQueue: string;
  originalJobId: string;
  originalJobName: string;
  payload: Record<string, unknown>;
  attemptsMade: number;
  failedReason: string;
  requestId?: string;
  outboxEventId?: string;
  timestamp: string;
}

export function isFinalBullMqFailure(job: Pick<Job, 'attemptsMade' | 'opts'>): boolean {
  const maxAttempts = job.opts.attempts ?? 1;
  return job.attemptsMade >= maxAttempts;
}

export function buildDeadLetterJobData(
  originalQueue: string,
  job: Pick<Job, 'id' | 'name' | 'data' | 'attemptsMade' | 'failedReason'>,
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

  return {
    originalQueue,
    originalJobId: String(job.id),
    originalJobName: job.name,
    payload,
    attemptsMade: job.attemptsMade,
    failedReason: error.message || job.failedReason || 'unknown',
    ...(requestId ? { requestId } : {}),
    ...(outboxEventId ? { outboxEventId } : {}),
    timestamp: new Date().toISOString(),
  };
}

function normalizePayload(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }

  return { value: payload };
}
