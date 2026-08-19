import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { ERROR_CODE_MAP, getStatusCodeForError } from './error-codes';

const DOMAIN_ERRORS_DIR = join(
  __dirname,
  '../../../../../packages/core/src/domain/errors',
);

function productionDomainErrorCodes(): string[] {
  return readdirSync(DOMAIN_ERRORS_DIR)
    .filter((file) => file.endsWith('.error.ts') && file !== 'domain-error.ts')
    .flatMap((file) => {
      const source = readFileSync(join(DOMAIN_ERRORS_DIR, file), 'utf8');
      const matches = [
        ...source.matchAll(
          /super\(\s*(?:`[^`]*`|'[^']*'|"[^"]*")\s*,\s*'([A-Z0-9_]+)'/g,
        ),
        ...source.matchAll(
          /super\(\s*(?:`[^`]*`|'[^']*'|"[^"]*")\s*,\s*"([A-Z0-9_]+)"/g,
        ),
      ];
      return matches.map((match) => match[1]);
    })
    .filter((code, index, all) => all.indexOf(code) === index)
    .sort();
}

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
    ['PAYMENT_EXPIRED', 422],
    ['INVALID_PAYMENT_STATUS_TRANSITION', 422],
    ['PAYMENT_NOT_CONFIRMED', 422],
    ['CUSTOMER_NOT_FOUND', 404],
    ['RECEIPT_NOT_FOUND', 404],
    ['NO_CURRENT_STORE', 403],
  ] as const)('maps %s to %s', (code, status) => {
    expect(getStatusCodeForError(code)).toBe(status);
  });

  it('maps every production DomainError code to a non-500 status', () => {
    const codes = productionDomainErrorCodes();
    expect(codes.length).toBeGreaterThan(40);

    const unmapped = codes.filter((code) => !(code in ERROR_CODE_MAP));
    const mappedTo500 = codes.filter(
      (code) => getStatusCodeForError(code) === 500,
    );

    expect(unmapped).toEqual([]);
    expect(mappedTo500).toEqual([]);
  });
});
