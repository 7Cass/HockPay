import { randomUUID } from 'crypto';

export function createWorkerRequestId(scope: string, stableId?: string | number): string {
  return `worker:${scope}:${stableId ?? randomUUID()}`;
}
