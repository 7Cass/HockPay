import {
  createIdempotencyFingerprint,
  generateIdempotencyCacheKey,
} from './idempotency-fingerprint';

describe('createIdempotencyFingerprint', () => {
  it('uses a canonical body hash independent from object key order', () => {
    const first = createIdempotencyFingerprint({
      method: 'post',
      path: '/api/v1/payments',
      body: {
        amount: 1000,
        customer: {
          name: 'Customer',
          document: '12345678901',
        },
        metadata: {
          source: 'raw-body',
          run: 1,
        },
      },
    });

    const second = createIdempotencyFingerprint({
      method: 'POST',
      path: '/api/v1/payments',
      body: {
        metadata: {
          run: 1,
          source: 'raw-body',
        },
        customer: {
          document: '12345678901',
          name: 'Customer',
        },
        amount: 1000,
      },
    });

    expect(first).toEqual(second);
  });

  it('omits undefined fields so raw and DTO-shaped bodies can match', () => {
    const raw = createIdempotencyFingerprint({
      method: 'POST',
      path: '/api/v1/payments',
      body: {
        amount: 1000,
        customer: {
          document: '12345678901',
        },
      },
    });

    const dtoShaped = createIdempotencyFingerprint({
      method: 'POST',
      path: '/api/v1/payments',
      body: {
        amount: 1000,
        externalId: undefined,
        customer: {
          document: '12345678901',
          email: undefined,
        },
      },
    });

    expect(dtoShaped.requestHash).toBe(raw.requestHash);
  });

  it('isolates Redis cache keys by environment', () => {
    expect(generateIdempotencyCacheKey('idem-1', 'store-1', 'TEST')).not.toBe(
      generateIdempotencyCacheKey('idem-1', 'store-1', 'LIVE'),
    );
  });
});
