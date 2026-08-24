import { describe, expect, it, vi } from 'vitest';
import { AccountRepository } from './account.repository';

describe('AccountRepository', () => {
  it('locks and reconstitutes an account by id', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'account-1',
          storeId: 'store-1',
          available: 100,
          pending: 200,
          blocked: 50,
          currency: 'BRL',
          updatedAt: new Date('2026-05-19T00:00:00.000Z'),
        },
      ]),
    };
    const repository = new AccountRepository(prisma as any);

    const account = await repository.findByIdForUpdate('account-1');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw.mock.calls[0][1]).toBe('account-1');
    expect(String(prisma.$queryRaw.mock.calls[0][0].join(' '))).toContain('FOR UPDATE');
    expect(account?.id).toBe('account-1');
    expect(account?.storeId).toBe('store-1');
    expect(account?.totalBalance).toBe(350);
  });

  it('locks and reconstitutes an account by store id', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'account-1',
          storeId: 'store-1',
          available: 100,
          pending: 200,
          blocked: 50,
          currency: 'BRL',
          updatedAt: new Date('2026-05-19T00:00:00.000Z'),
        },
      ]),
    };
    const repository = new AccountRepository(prisma as any);

    const account = await repository.findByStoreIdForUpdate('store-1');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw.mock.calls[0][1]).toBe('store-1');
    expect(String(prisma.$queryRaw.mock.calls[0][0].join(' '))).toContain('WHERE store_id =');
    expect(String(prisma.$queryRaw.mock.calls[0][0].join(' '))).toContain('FOR UPDATE');
    expect(account?.id).toBe('account-1');
  });

  it('selects only settlement-eligible accounts with pending confirmed payments', async () => {
    const cutoffDate = new Date('2026-05-20T00:00:00.000Z');
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'account-1',
          store_id: 'store-1',
          available: 100,
          pending: 7855,
          blocked: 0,
          currency: 'BRL',
          updated_at: new Date('2026-05-19T00:00:00.000Z'),
        },
      ]),
    };
    const repository = new AccountRepository(prisma as any);

    const accounts = await repository.findWithPendingBalance(cutoffDate);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    // O cutoff entra como fragmento normalizado em UTC, nao como Date cru: em
    // sessao nao-UTC um Date cru seria convertido pelo timezone da sessao e o
    // predicado deixaria de casar. Ver `sql/utc-timestamp`.
    const cutoffParam = prisma.$queryRaw.mock.calls[0][1];
    expect(cutoffParam.sql ?? cutoffParam.strings.join('')).toContain("AT TIME ZONE 'UTC'");
    expect(cutoffParam.values).toEqual([cutoffDate]);
    expect(String(prisma.$queryRaw.mock.calls[0][0].join(' '))).toContain("p.status = 'CONFIRMED'");
    expect(accounts).toHaveLength(1);
    expect(accounts[0].storeId).toBe('store-1');
    expect(accounts[0].pending).toBe(7855);
  });
});
