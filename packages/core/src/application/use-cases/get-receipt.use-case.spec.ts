import { describe, expect, it, vi } from 'vitest';
import { GetReceiptUseCase } from './get-receipt.use-case';
import { ReceiptNotFoundError } from '../../domain/errors/receipt-not-found.error';
import { IReceiptRepository } from '../../domain/repositories/receipt.repository.interface';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { Environment } from '../../domain/value-objects/environment.vo';

describe('GetReceiptUseCase', () => {
  it('loads a receipt by receipt number and enforces store scoping', async () => {
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

    const repository: Partial<IReceiptRepository> = {
      findById: vi.fn(),
      findByPaymentId: vi.fn(),
      findByReceiptNumber: vi.fn().mockResolvedValue({
        id: 'receipt-1',
        paymentId: 'payment-1',
        storeId: 'store-1',
        toObject: () => receiptObject,
      }),
    };
    const paymentRepository: Partial<IPaymentRepository> = {
      findByIdAndStoreId: vi.fn().mockResolvedValue({
        environment: Environment.TEST,
        items: [],
      }),
    };

    const useCase = new GetReceiptUseCase(
      repository as IReceiptRepository,
      paymentRepository as IPaymentRepository,
    );
    const result = await useCase.execute({
      receiptNumber: 'RCP-20260419-STORE1-00001',
      storeId: 'store-1',
      environment: Environment.TEST,
    });

    expect(repository.findByReceiptNumber).toHaveBeenCalledWith('RCP-20260419-STORE1-00001');
    expect(result.receipt).toEqual({ ...receiptObject, items: [] });
  });

  it('throws ReceiptNotFoundError when the receipt belongs to another store', async () => {
    const repository: Partial<IReceiptRepository> = {
      findById: vi.fn(),
      findByPaymentId: vi.fn(),
      findByReceiptNumber: vi.fn().mockResolvedValue({
        storeId: 'store-2',
        toObject: vi.fn(),
      }),
    };

    const useCase = new GetReceiptUseCase(repository as IReceiptRepository);

    await expect(
      useCase.execute({
        receiptNumber: 'RCP-20260419-STORE1-00099',
        storeId: 'store-1',
        environment: Environment.TEST,
      }),
    ).rejects.toThrow(ReceiptNotFoundError);
  });

  it('throws ReceiptNotFoundError when the payment is LIVE and the caller is TEST', async () => {
    const repository: Partial<IReceiptRepository> = {
      findById: vi.fn(),
      findByPaymentId: vi.fn(),
      findByReceiptNumber: vi.fn().mockResolvedValue({
        id: 'receipt-1',
        paymentId: 'payment-live',
        storeId: 'store-1',
        toObject: () => ({ id: 'receipt-1' }),
      }),
    };
    const paymentRepository: Partial<IPaymentRepository> = {
      findByIdAndStoreId: vi.fn().mockResolvedValue({
        environment: Environment.LIVE,
        items: [],
      }),
    };

    const useCase = new GetReceiptUseCase(
      repository as IReceiptRepository,
      paymentRepository as IPaymentRepository,
    );

    await expect(
      useCase.execute({
        receiptNumber: 'RCP-20260419-STORE1-00001',
        storeId: 'store-1',
        environment: Environment.TEST,
      }),
    ).rejects.toThrow(ReceiptNotFoundError);
  });
});
