import { describe, expect, it, vi } from 'vitest';
import { Store } from '@hockpay/core';
import { StoreRepository } from './store.repository';

describe('StoreRepository', () => {
  it('creates an account with an explicit id when saving a store', async () => {
    const prisma = {
      store: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      account: {
        createMany: vi.fn().mockResolvedValue(undefined),
      },
    };
    const store = Store.create({
      merchantId: 'merchant-1',
      name: 'Media Kit',
      slug: 'media-kit',
      isApproved: true,
    });

    const repository = new StoreRepository(prisma as any);

    await repository.save(store);

    // Uma conta por ambiente, criadas juntas: uma loja nunca existe com metade
    // do ledger.
    expect(prisma.account.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ storeId: store.id, environment: 'TEST', available: 0 }),
        expect.objectContaining({ storeId: store.id, environment: 'LIVE', available: 0 }),
      ],
    });
  });

  it('uses a transaction when the provided prisma client supports it', async () => {
    const tx = {
      store: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      account: {
        createMany: vi.fn().mockResolvedValue(undefined),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof tx) => Promise<void>) => work(tx)),
    };
    const store = Store.create({
      merchantId: 'merchant-1',
      name: 'Media Kit',
      slug: 'media-kit',
      isApproved: true,
    });

    const repository = new StoreRepository(prisma as any);

    await repository.save(store);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.store.create).toHaveBeenCalledTimes(1);
    expect(tx.account.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ storeId: store.id, environment: 'TEST' }),
        expect.objectContaining({ storeId: store.id, environment: 'LIVE' }),
      ],
    });
  });
});
