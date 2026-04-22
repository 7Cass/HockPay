import { describe, expect, it, vi } from 'vitest';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case';
import { Payment } from '../../domain/entities/payment.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { Customer } from '../../domain/entities/customer.entity';
import { Document } from '../../domain/value-objects/document.vo';

describe('ConfirmPaymentUseCase', () => {
  const account = {
    id: 'account-1',
    totalBalance: 7855,
    addToPending: vi.fn(),
  };

  const store = {
    id: 'store-1',
    name: 'Hockpay Store',
  };

  it('builds the receipt from the payment payer snapshot', async () => {
    const payment = Payment.create({
      storeId: 'store-1',
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      payerName: 'Visitante',
      payerEmail: 'guest@example.com',
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.TEST,
    });

    let savedReceipt: any;

    const unitOfWork = {
      execute: async (work: any) =>
        work({
          paymentRepository: {
            findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
            update: vi.fn(),
          },
          accountRepository: {
            findByStoreId: vi.fn().mockResolvedValue(account),
            update: vi.fn(),
          },
          transactionRepository: {
            save: vi.fn(),
          },
          bankAccountRepository: {},
          outboxWriter: {
            save: vi.fn(),
          },
          receiptRepository: {
            incrementCounter: vi.fn().mockResolvedValue(1),
            save: vi.fn(async (receipt: any) => {
              savedReceipt = receipt;
            }),
          },
          storeRepository: {
            findById: vi.fn().mockResolvedValue(store),
          },
        }),
    };

    const useCase = new ConfirmPaymentUseCase(
      unitOfWork as any,
      {
        findById: vi.fn(),
      } as any,
    );

    await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
    });

    expect(savedReceipt.payerName).toBe('Visitante');
    expect(savedReceipt.payerEmail).toBe('guest@example.com');
  });

  it('falls back to the associated customer when the payment has no payer snapshot', async () => {
    const customer = Customer.create({
      storeId: 'store-1',
      name: 'Cliente Legado',
      email: 'legacy@example.com',
      document: new Document('52998224725'),
    });

    const payment = Payment.create({
      storeId: 'store-1',
      customerId: customer.id,
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.TEST,
    });

    let savedReceipt: any;

    const unitOfWork = {
      execute: async (work: any) =>
        work({
          paymentRepository: {
            findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
            update: vi.fn(),
          },
          accountRepository: {
            findByStoreId: vi.fn().mockResolvedValue(account),
            update: vi.fn(),
          },
          transactionRepository: {
            save: vi.fn(),
          },
          bankAccountRepository: {},
          outboxWriter: {
            save: vi.fn(),
          },
          receiptRepository: {
            incrementCounter: vi.fn().mockResolvedValue(1),
            save: vi.fn(async (receipt: any) => {
              savedReceipt = receipt;
            }),
          },
          storeRepository: {
            findById: vi.fn().mockResolvedValue(store),
          },
        }),
    };

    const useCase = new ConfirmPaymentUseCase(
      unitOfWork as any,
      {
        findById: vi.fn().mockResolvedValue(customer),
      } as any,
    );

    await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
    });

    expect(savedReceipt.payerName).toBe('Cliente Legado');
    expect(savedReceipt.payerDocument).toBe('52998224725');
    expect(savedReceipt.payerEmail).toBe('legacy@example.com');
  });
});
