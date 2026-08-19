import { describe, expect, it, vi } from 'vitest';
import { ListReceiptsUseCase } from './list-receipts.use-case';
import { IReceiptRepository } from '../../domain/repositories/receipt.repository.interface';
import { Environment } from '../../domain/value-objects/environment.vo';

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
      environment: Environment.TEST,
      page: 2,
      limit: 10,
      receiptNumber: 'RCP-20260419-STORE1-00001',
      customerId: 'customer-1',
    });

    expect(repository.findByStoreId).toHaveBeenCalledWith('store-1', 2, 10, {
      receiptNumber: 'RCP-20260419-STORE1-00001',
      customerId: 'customer-1',
      environment: Environment.TEST,
    });
    expect(result.receipts).toEqual([{ ...receiptObject, items: [] }]);
    expect(result.totalPages).toBe(1);
  });

  it('hydrates receipt items with one payment query for the page', async () => {
    const receipts = ['payment-1', 'payment-2', 'payment-3'].map((paymentId) => ({
      paymentId,
      toObject: () => ({
        id: `receipt-${paymentId}`,
        paymentId,
        storeId: 'store-1',
      }),
    }));
    const receiptRepository: Pick<IReceiptRepository, 'findByStoreId'> = {
      findByStoreId: vi.fn().mockResolvedValue({
        items: receipts,
        total: 3,
      }),
    };
    const paymentRepository = {
      findByIdsAndStoreId: vi.fn().mockResolvedValue([
        { id: 'payment-1', items: [{ name: 'A', quantity: 1 }] },
        { id: 'payment-2', items: [] },
        { id: 'payment-3', items: [{ name: 'C', quantity: 2 }] },
      ]),
      findByIdAndStoreId: vi.fn(),
    };

    const useCase = new ListReceiptsUseCase(
      receiptRepository as IReceiptRepository,
      paymentRepository as never,
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      environment: Environment.TEST,
    });

    expect(paymentRepository.findByIdsAndStoreId).toHaveBeenCalledOnce();
    expect(paymentRepository.findByIdsAndStoreId).toHaveBeenCalledWith(
      ['payment-1', 'payment-2', 'payment-3'],
      'store-1',
    );
    expect(paymentRepository.findByIdAndStoreId).not.toHaveBeenCalled();
    expect(result.receipts.map((receipt) => receipt.items?.length ?? 0)).toEqual([
      1, 0, 1,
    ]);
  });
});
