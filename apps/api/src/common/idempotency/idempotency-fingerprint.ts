import { createHash } from 'crypto';

export interface IdempotencyFingerprint {
  requestMethod: string;
  requestPath: string;
  requestHash: string;
}

export function createIdempotencyFingerprint(input: {
  method: string;
  path: string;
  body: unknown;
}): IdempotencyFingerprint {
  return {
    requestMethod: input.method.toUpperCase(),
    requestPath: input.path,
    requestHash: sha256(JSON.stringify(input.body ?? '')),
  };
}

export function generateIdempotencyCacheKey(
  idempotencyKey: string,
  storeId: string,
): string {
  return sha256(`${idempotencyKey}:${storeId}`);
}

export function matchesIdempotencyFingerprint(
  cached: IdempotencyFingerprint,
  request: IdempotencyFingerprint,
): boolean {
  return (
    cached.requestMethod.toUpperCase() === request.requestMethod.toUpperCase() &&
    cached.requestPath === request.requestPath &&
    cached.requestHash === request.requestHash
  );
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}
