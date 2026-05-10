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
        create: vi.fn().mockResolvedValue(undefined),
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

    expect(prisma.account.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        storeId: store.id,
        available: 0,
        pending: 0,
        blocked: 0,
        currency: 'BRL',
        updatedAt: expect.any(Date),
      },
    });
  });
});
