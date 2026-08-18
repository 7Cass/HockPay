import { describe, expect, it } from '@jest/globals';
import { getStatusCodeForError } from './error-codes';

describe('getStatusCodeForError', () => {
  it.each([
    ['INVALID_BALANCE', 422],
    ['INVALID_REFUND_AMOUNT', 400],
    ['INVALID_REFUND_STATUS', 409],
    ['CHECKOUT_SESSION_NOT_FOUND', 404],
    ['CHECKOUT_SESSION_EXPIRED', 422],
    ['CHECKOUT_SESSION_INVALID_STATUS', 422],
    ['PAYMENT_LINK_NOT_FOUND', 404],
    ['PAYMENT_LINK_UNAVAILABLE', 422],
    ['PAYMENT_LINK_INVALID_EXPIRATION', 400],
    ['BANK_ACCOUNT_HOLDER_MISMATCH', 422],
    ['UNAUTHORIZED_BANK_ACCOUNT_ACCESS', 403],
    ['RECEIPT_ALREADY_CANCELLED', 409],
    ['INVALID_SIMULATION_ACTION', 400],
    ['STORE_NOT_FOUND', 404],
    ['MERCHANT_NOT_FOUND', 404],
  ] as const)('maps %s to %s', (code, status) => {
    expect(getStatusCodeForError(code)).toBe(status);
  });
});
