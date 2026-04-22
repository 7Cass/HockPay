import { NotFoundException } from '@nestjs/common';
import {
  GetReceiptUseCase,
  ListReceiptsUseCase,
  ReceiptNotFoundError,
} from '@hockpay/core';
import { ReceiptController } from './receipt.controller';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

describe('ReceiptController', () => {
  let controller: ReceiptController;
  let getReceiptUseCase: { execute: jest.Mock };
  let listReceiptsUseCase: { execute: jest.Mock };

  beforeEach(() => {
    getReceiptUseCase = {
      execute: jest.fn(),
    };

    listReceiptsUseCase = {
      execute: jest.fn(),
    };

    controller = new ReceiptController(
      getReceiptUseCase as unknown as GetReceiptUseCase,
      listReceiptsUseCase as unknown as ListReceiptsUseCase,
    );
  });

  it('marks the controller as public for CombinedAuthGuard-only access', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ReceiptController)).toBe(true);
  });

  it('forwards list filters to the list use case', async () => {
    listReceiptsUseCase.execute.mockResolvedValue({
      receipts: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    await controller.listReceipts(
      {
        page: 1,
        limit: 20,
        receiptNumber: 'RCP-20260419-00001',
        customerId: 'customer-1',
      },
      {
        store: { id: 'store-1' },
      } as any,
    );

    expect(listReceiptsUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      page: 1,
      limit: 20,
      receiptNumber: 'RCP-20260419-00001',
      customerId: 'customer-1',
    });
  });

  it('loads a receipt by receipt number', async () => {
    getReceiptUseCase.execute.mockResolvedValue({
      receipt: {
        id: 'receipt-1',
        receiptNumber: 'RCP-20260419-00001',
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
      },
    });

    await controller.getReceiptByNumber('RCP-20260419-00001', {
      store: { id: 'store-1' },
    } as any);

    expect(getReceiptUseCase.execute).toHaveBeenCalledWith({
      receiptNumber: 'RCP-20260419-00001',
      storeId: 'store-1',
    });
  });

  it('maps receipt-not-found errors to NotFoundException on receipt-number lookups', async () => {
    getReceiptUseCase.execute.mockRejectedValue(
      new ReceiptNotFoundError('RCP-20260419-99999'),
    );

    await expect(
      controller.getReceiptByNumber('RCP-20260419-99999', {
        store: { id: 'store-1' },
      } as any),
    ).rejects.toThrow(NotFoundException);
  });
});
