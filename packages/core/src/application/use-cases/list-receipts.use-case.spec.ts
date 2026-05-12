import { describe, expect, it, vi } from 'vitest';
import { ListReceiptsUseCase } from './list-receipts.use-case';
import { IReceiptRepository } from '../../domain/repositories/receipt.repository.interface';

describe('ListReceiptsUseCase', () => {
  it('forwards store-scoped pagination and filters to the repository', async () => {
    const receiptObject = {
      id: 'receipt-1',
      receiptNumber: 'RCP-20260419-STORE1-00001',
      paymentId: 'payment-1',
      storeId: 'store-1',
      payeeName: 'Hockpay Store',
      amount: 1000,
      fee: 100,
      netAmount: 900,
      currency: 'BRL',
      status: 'ISSUED',
      issuedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const repository: Pick<IReceiptRepository, 'findByStoreId'> = {
      findByStoreId: vi.fn().mockResolvedValue({
        items: [
          {
            toObject: () => receiptObject,
          },
        ],
        total: 1,
      }),
    };

    const useCase = new ListReceiptsUseCase(repository as IReceiptRepository);

    const result = await useCase.execute({
      storeId: 'store-1',
      page: 2,
      limit: 10,
      receiptNumber: 'RCP-20260419-STORE1-00001',
      customerId: 'customer-1',
    });

    expect(repository.findByStoreId).toHaveBeenCalledWith('store-1', 2, 10, {
      receiptNumber: 'RCP-20260419-STORE1-00001',
      customerId: 'customer-1',
    });
    expect(result.receipts).toEqual([receiptObject]);
    expect(result.totalPages).toBe(1);
  });
});
