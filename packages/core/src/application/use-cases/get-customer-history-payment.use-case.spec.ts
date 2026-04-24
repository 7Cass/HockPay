import { describe, expect, it, vi } from 'vitest';
import { Customer } from '../../domain/entities/customer.entity';
import { Document } from '../../domain/value-objects/document.vo';
import { Payment } from '../../domain/entities/payment.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { PaymentMethod } from '../../domain/entities/payment.entity';
import { GetCustomerHistoryPaymentUseCase } from './get-customer-history-payment.use-case';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';

describe('GetCustomerHistoryPaymentUseCase', () => {
  it('returns a payment when it belongs to the resolved customer', async () => {
    const customer = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_123',
      document: new Document('52998224725'),
    });

    const payment = Payment.create({
      id: 'payment-1',
      storeId: 'store-1',
      customerId: customer.id,
      amount: 1000,
      fee: 10,
      netAmount: 990,
      environment: Environment.TEST,
      paymentMethod: PaymentMethod.PIX,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const useCase = new GetCustomerHistoryPaymentUseCase(
      {
        findByExternalId: vi.fn().mockResolvedValue(customer),
      } as any,
      {
        findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
        update: vi.fn(),
      } as any,
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      customerExternalId: 'cust_123',
      paymentId: 'payment-1',
    });

    expect(result.payment.id).toBe(payment.id);
  });

  it('returns not found when the payment belongs to another customer', async () => {
    const customer = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_123',
      document: new Document('52998224725'),
    });

    const payment = Payment.create({
      id: 'payment-1',
      storeId: 'store-1',
      customerId: 'other-customer',
      amount: 1000,
      fee: 10,
      netAmount: 990,
      environment: Environment.TEST,
      paymentMethod: PaymentMethod.PIX,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const useCase = new GetCustomerHistoryPaymentUseCase(
      {
        findByExternalId: vi.fn().mockResolvedValue(customer),
      } as any,
      {
        findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
        update: vi.fn(),
      } as any,
    );

    await expect(
      useCase.execute({
        storeId: 'store-1',
        customerExternalId: 'cust_123',
        paymentId: 'payment-1',
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);
  });
});
