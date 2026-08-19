import { describe, expect, it, vi } from 'vitest';
import { Customer } from '../../domain/entities/customer.entity';
import { Document } from '../../domain/value-objects/document.vo';
import { Environment } from '../../domain/value-objects/environment.vo';
import { Receipt } from '../../domain/entities/receipt.entity';
import { ReceiptStatus } from '../../domain/entities/receipt.entity';
import { ListCustomerHistoryReceiptsUseCase } from './list-customer-history-receipts.use-case';

describe('ListCustomerHistoryReceiptsUseCase', () => {
  it('lists only receipts for the resolved customer', async () => {
    const customer = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_123',
      document: new Document('52998224725'),
    });

    const receipt = Receipt.create({
      paymentId: 'payment-1',
      storeId: 'store-1',
      payeeName: 'Store',
      amount: 1000,
      fee: 10,
      netAmount: 990,
      currency: 'BRL',
      status: ReceiptStatus.ISSUED,
      issuedAt: new Date(),
    });

    const receiptRepository = {
      findByStoreId: vi.fn().mockResolvedValue({
        items: [receipt],
        total: 1,
      }),
    };

    const useCase = new ListCustomerHistoryReceiptsUseCase(
      {
        findByExternalId: vi.fn().mockResolvedValue(customer),
      } as any,
      receiptRepository as any,
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      customerExternalId: 'cust_123',
      environment: Environment.TEST,
    });

    expect(receiptRepository.findByStoreId).toHaveBeenCalledWith(
      'store-1',
      1,
      20,
      {
        receiptNumber: undefined,
        customerId: customer.id,
        environment: Environment.TEST,
      },
    );
    expect(result.receipts).toHaveLength(1);
  });
});
