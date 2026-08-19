import { describe, expect, it, vi } from 'vitest';
import { Customer } from '../../domain/entities/customer.entity';
import { Document } from '../../domain/value-objects/document.vo';
import { Receipt } from '../../domain/entities/receipt.entity';
import { ReceiptStatus } from '../../domain/entities/receipt.entity';
import { Payment } from '../../domain/entities/payment.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { PaymentMethod } from '../../domain/entities/payment.entity';
import { GetCustomerHistoryReceiptUseCase } from './get-customer-history-receipt.use-case';
import { ReceiptNotFoundError } from '../../domain/errors/receipt-not-found.error';

describe('GetCustomerHistoryReceiptUseCase', () => {
  it('returns a receipt when it belongs to a payment of the resolved customer', async () => {
    const customer = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_123',
      document: new Document('52998224725'),
    });

    const receipt = Receipt.create({
      id: 'receipt-1',
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

    const useCase = new GetCustomerHistoryReceiptUseCase(
      {
        findByExternalId: vi.fn().mockResolvedValue(customer),
      } as any,
      {
        findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
      } as any,
      {
        findById: vi.fn().mockResolvedValue(receipt),
      } as any,
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      customerExternalId: 'cust_123',
      receiptId: 'receipt-1',
      environment: Environment.TEST,
    });

    expect(result.receipt.id).toBe(receipt.id);
  });

  it('returns not found when the receipt payment belongs to another customer', async () => {
    const customer = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_123',
      document: new Document('52998224725'),
    });

    const receipt = Receipt.create({
      id: 'receipt-1',
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

    const useCase = new GetCustomerHistoryReceiptUseCase(
      {
        findByExternalId: vi.fn().mockResolvedValue(customer),
      } as any,
      {
        findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
      } as any,
      {
        findById: vi.fn().mockResolvedValue(receipt),
      } as any,
    );

    await expect(
      useCase.execute({
        storeId: 'store-1',
        customerExternalId: 'cust_123',
        receiptId: 'receipt-1',
        environment: Environment.TEST,
      }),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });

  it('returns not found when the receipt payment is LIVE and the caller is TEST', async () => {
    const customer = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_123',
      document: new Document('52998224725'),
    });

    const receipt = Receipt.create({
      id: 'receipt-1',
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

    const payment = Payment.create({
      id: 'payment-1',
      storeId: 'store-1',
      customerId: customer.id,
      amount: 1000,
      fee: 10,
      netAmount: 990,
      environment: Environment.LIVE,
      paymentMethod: PaymentMethod.PIX,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const useCase = new GetCustomerHistoryReceiptUseCase(
      {
        findByExternalId: vi.fn().mockResolvedValue(customer),
      } as never,
      {
        findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
      } as never,
      {
        findById: vi.fn().mockResolvedValue(receipt),
      } as never,
    );

    await expect(
      useCase.execute({
        storeId: 'store-1',
        customerExternalId: 'cust_123',
        receiptId: 'receipt-1',
        environment: Environment.TEST,
      }),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });
});
