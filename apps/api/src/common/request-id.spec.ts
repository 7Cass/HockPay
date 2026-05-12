import { getOrCreateRequestId, getRequestId } from './request-id';

describe('request id helpers', () => {
  it('preserves an incoming X-Request-ID header', () => {
    const request = {
      headers: {
        'x-request-id': 'req-client-1',
      },
    } as any;

    expect(getOrCreateRequestId(request)).toBe('req-client-1');
    expect(getRequestId(request)).toBe('req-client-1');
  });

  it('generates an id when the request has no header', () => {
    const request = { headers: {} } as any;

    const requestId = getOrCreateRequestId(request);

    expect(requestId).toEqual(expect.any(String));
    expect(getRequestId(request)).toBe(requestId);
  });
});
