import type { Request } from 'express';

export interface IdempotencyRequestContext {
  key: string;
  ttlSeconds?: number;
}

const IDEMPOTENCY_REQUEST_CONTEXT = Symbol('IDEMPOTENCY_REQUEST_CONTEXT');

export function readIdempotencyKeyHeader(request?: Request): string | undefined {
  const value = request?.headers['idempotency-key'];
  const key = Array.isArray(value) ? value[0] : value;
  const normalized = key?.trim();

  return normalized || undefined;
}

export function setIdempotencyRequestContext(
  request: Request,
  context: IdempotencyRequestContext,
): void {
  (request as any)[IDEMPOTENCY_REQUEST_CONTEXT] = context;
}

export function getIdempotencyRequestContext(
  request?: Request,
): IdempotencyRequestContext | undefined {
  return request
    ? ((request as any)[IDEMPOTENCY_REQUEST_CONTEXT] as
        | IdempotencyRequestContext
        | undefined)
    : undefined;
}
