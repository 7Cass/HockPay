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
    requestHash: sha256(stableStringify(input.body ?? '')),
  };
}

export function generateIdempotencyCacheKey(
  idempotencyKey: string,
  storeId: string,
  environment: string,
): string {
  return sha256(`${idempotencyKey}:${storeId}:${environment}`);
}

export function matchesIdempotencyFingerprint(
  cached: IdempotencyFingerprint,
  request: IdempotencyFingerprint,
): boolean {
  return (
    cached.requestMethod.toUpperCase() ===
      request.requestMethod.toUpperCase() &&
    cached.requestPath === request.requestPath &&
    cached.requestHash === request.requestHash
  );
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const nestedValue = (value as Record<string, unknown>)[key];
        if (nestedValue !== undefined) {
          result[key] = sortObjectKeys(nestedValue);
        }
        return result;
      }, {});
  }

  return value;
}
