import { randomUUID } from 'crypto';
import type { Request } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
export const RESPONSE_REQUEST_ID_HEADER = 'X-Request-ID';

export function getRequestId(request?: Request): string | undefined {
  return request ? ((request as any).id as string | undefined) : undefined;
}

export function getOrCreateRequestId(request: Request): string {
  const existing = getRequestId(request);
  if (isValidRequestId(existing)) {
    return existing;
  }

  const header = request.headers[REQUEST_ID_HEADER];
  const headerValue = Array.isArray(header) ? header[0] : header;
  const requestId = isValidRequestId(headerValue) ? headerValue : randomUUID();
  (request as any).id = requestId;
  return requestId;
}

function isValidRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= 128
  );
}
