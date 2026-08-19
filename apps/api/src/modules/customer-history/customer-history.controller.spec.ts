import { ForbiddenException } from '@nestjs/common';
import {
  CustomerNotFoundError,
  Environment,
  GetCustomerHistoryPaymentUseCase,
  GetCustomerHistoryReceiptUseCase,
  ListCustomerHistoryPaymentsUseCase,
  ListCustomerHistoryReceiptsUseCase,
  PaymentNotFoundError,
  ReceiptNotFoundError,
} from '@hockpay/core';
import { CustomerHistoryController } from './customer-history.controller';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

describe('CustomerHistoryController', () => {
  let controller: CustomerHistoryController;
  let listPaymentsUseCase: { execute: jest.Mock };
  let getPaymentUseCase: { execute: jest.Mock };
  let listReceiptsUseCase: { execute: jest.Mock };
  let getReceiptUseCase: { execute: jest.Mock };

  beforeEach(() => {
    listPaymentsUseCase = { execute: jest.fn() };
    getPaymentUseCase = { execute: jest.fn() };
    listReceiptsUseCase = { execute: jest.fn() };
    getReceiptUseCase = { execute: jest.fn() };

    controller = new CustomerHistoryController(
      listPaymentsUseCase as unknown as ListCustomerHistoryPaymentsUseCase,
      getPaymentUseCase as unknown as GetCustomerHistoryPaymentUseCase,
      listReceiptsUseCase as unknown as ListCustomerHistoryReceiptsUseCase,
      getReceiptUseCase as unknown as GetCustomerHistoryReceiptUseCase,
    );
  });

  it('marks the controller as public for CombinedAuthGuard composition', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, CustomerHistoryController)).toBe(
      true,
    );
  });

  it('rejects dashboard cookie auth because the surface is API-key only', async () => {
    await expect(
      controller.listPayments('cust_123', {}, 'store-1', Environment.TEST, {
        authType: 'jwt',
        store: { id: 'store-1' },
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forwards payment list filters for api key requests', async () => {
    listPaymentsUseCase.execute.mockResolvedValue({
      payments: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    await controller.listPayments(
      'cust_123',
      {
        page: 1,
        limit: 20,
        status: 'CONFIRMED',
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-30T00:00:00.000Z',
      } as never,
      'store-1',
      Environment.TEST,
      { authType: 'api_key', store: { id: 'store-1' } } as never,
    );

    expect(listPaymentsUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      customerExternalId: 'cust_123',
      page: 1,
      limit: 20,
      status: 'CONFIRMED',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T00:00:00.000Z'),
      environment: Environment.TEST,
    });
  });

  it('forwards environment on receipt list for api key requests', async () => {
    listReceiptsUseCase.execute.mockResolvedValue({
      receipts: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    await controller.listReceipts(
      'cust_123',
      { page: 1, limit: 20 },
      'store-1',
      Environment.TEST,
      { authType: 'api_key', store: { id: 'store-1' } } as never,
    );

    expect(listReceiptsUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      customerExternalId: 'cust_123',
      environment: Environment.TEST,
      page: 1,
      limit: 20,
      receiptNumber: undefined,
    });
  });

  it('maps customer-not-found to 404 on list endpoints', async () => {
    listReceiptsUseCase.execute.mockRejectedValue(
      new CustomerNotFoundError('missing'),
    );

    await expect(
      controller.listReceipts('missing', {}, 'store-1', Environment.TEST, {
        authType: 'api_key',
        store: { id: 'store-1' },
      } as never),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it('maps payment-not-found to 404 on payment detail', async () => {
    getPaymentUseCase.execute.mockRejectedValue(
      new PaymentNotFoundError('payment-1'),
    );

    await expect(
      controller.getPayment('cust_123', 'payment-1', 'store-1', Environment.TEST, {
        authType: 'api_key',
        store: { id: 'store-1' },
      } as never),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);
  });

  it('maps receipt-not-found to 404 on receipt detail', async () => {
    getReceiptUseCase.execute.mockRejectedValue(
      new ReceiptNotFoundError('receipt-1'),
    );

    await expect(
      controller.getReceipt('cust_123', 'receipt-1', 'store-1', Environment.TEST, {
        authType: 'api_key',
        store: { id: 'store-1' },
      } as never),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });
});
