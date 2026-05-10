import { Store } from '@hockpay/core';
import { StoreRepository } from './store.repository.impl';

describe('StoreRepository', () => {
  it('creates the store and its account in one transaction with an explicit account id', async () => {
    const tx = {
      store: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      account: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (work: (tx: typeof tx) => Promise<void>) =>
        work(tx),
      ),
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
    expect(tx.account.create).toHaveBeenCalledWith({
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
