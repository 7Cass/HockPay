import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('payments_one_paid_per_pix_charge_idx', () => {
  const databaseRoot = resolve(__dirname, '../../database');
  const schema = readFileSync(resolve(databaseRoot, 'prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(
    resolve(
      databaseRoot,
      'prisma/migrations/20260523093000_unique_paid_payment_per_pix_charge/migration.sql',
    ),
    'utf8',
  );

  it('keeps the partial unique index named in both schema and migration', () => {
    expect(schema).toContain('payments_one_paid_per_pix_charge_idx');
    expect(migration).toContain('payments_one_paid_per_pix_charge_idx');
    expect(migration).toContain('"pix_charge_id"');
    expect(migration).toMatch(/"status" IN \('CONFIRMED', 'RELEASED'\)/);
  });
});
