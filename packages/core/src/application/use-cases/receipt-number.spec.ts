import { describe, expect, it } from 'vitest';
import { buildReceiptNumber } from './receipt-number';

describe('buildReceiptNumber', () => {
  it('includes the store id so per-store counters remain globally unique', () => {
    expect(buildReceiptNumber('7c0a6ec5-c551-49b1-873f-205935208773', '20260512', 1)).toBe(
      'RCP-20260512-7C0A6EC5C55149B1873F205935208773-00001',
    );
  });
});
