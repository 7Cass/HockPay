import { describe, expect, it, vi } from 'vitest';
import { Customer } from '../../domain/entities/customer.entity';
import { Document } from '../../domain/value-objects/document.vo';
import { Payment } from '../../domain/entities/payment.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { PaymentMethod } from '../../domain/entities/payment.entity';
import { ListCustomerHistoryPaymentsUseCase } from './list-customer-history-payments.use-case';
import { CustomerNotFoundError } from '../../domain/errors/customer-not-found.error';

describe('ListCustomerHistoryPaymentsUseCase', () => {
  it('lists only payments for the resolved customer', async () => {
    const customer = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_123',
      document: new Document('52998224725'),
    });

    const payment = Payment.create({
      storeId: 'store-1',
      customerId: customer.id,
      amount: 1000,
      fee: 10,
      netAmount: 990,
      environment: Environment.TEST,
      paymentMethod: PaymentMethod.PIX,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const list = vi.fn().mockResolvedValue({
      payments: [payment],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    const useCase = new ListCustomerHistoryPaymentsUseCase(
      {
        findByExternalId: vi.fn().mockResolvedValue(customer),
      } as any,
      {
        list,
      } as any,
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      customerExternalId: 'cust_123',
      environment: Environment.TEST,
    });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        customerId: customer.id,
        environment: Environment.TEST,
      }),
    );
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].customerId).toBe(customer.id);
  });

  it('fails when the customer externalId does not exist', async () => {
    const useCase = new ListCustomerHistoryPaymentsUseCase(
      {
        findByExternalId: vi.fn().mockResolvedValue(null),
      } as any,
      {
        list: vi.fn(),
      } as any,
    );

    await expect(
      useCase.execute({
        storeId: 'store-1',
        customerExternalId: 'missing',
        environment: Environment.TEST,
      }),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });
});
