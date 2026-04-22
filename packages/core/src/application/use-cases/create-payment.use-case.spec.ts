import { describe, expect, it, vi } from 'vitest';
import { CreatePaymentUseCase } from './create-payment.use-case';
import {
  CustomerIdentityConflictError,
} from '../../domain/errors/customer-identity-conflict.error';
import { Environment } from '../../domain/value-objects/environment.vo';
import { Customer } from '../../domain/entities/customer.entity';
import { Document } from '../../domain/value-objects/document.vo';
import { CustomerPromotionPolicy } from './create-payment.use-case';

describe('CreatePaymentUseCase', () => {
  const store = {
    id: 'store-1',
    name: 'Hockpay Store',
    isActive: true,
    isApproved: true,
    feePercent: 1.5,
    feeFixed: 15,
  };

  const pixQrCodeGenerator = {
    generate: vi.fn().mockResolvedValue({
      qrCodeBase64: 'qr-code',
      copyPaste: 'pix-copy-paste',
      txId: 'txid',
    }),
  };

  const expirationQueue = {
    scheduleExpiration: vi.fn(),
  };

  const feePolicy = {
    calculate: vi.fn().mockReturnValue({
      feeInCents: 135,
      netAmountInCents: 7855,
    }),
  };

  it('creates a guest payment without customerId and preserves payer snapshot', async () => {
    const paymentRepository = {
      externalIdExists: vi.fn().mockResolvedValue(false),
      save: vi.fn(),
    };

    const customerRepository = {
      findByExternalId: vi.fn(),
      findByDocument: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CreatePaymentUseCase(
      paymentRepository as any,
      customerRepository as any,
      { findById: vi.fn().mockResolvedValue(store) } as any,
      { save: vi.fn() } as any,
      pixQrCodeGenerator as any,
      expirationQueue as any,
      feePolicy as any,
      'test@hockpay.com',
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      amount: 7990,
      description: 'Compra avulsa',
      customer: {
        name: 'Visitante',
        email: 'guest@example.com',
      },
      environment: Environment.TEST,
    });

    expect(customerRepository.findByDocument).not.toHaveBeenCalled();
    expect(customerRepository.findByExternalId).not.toHaveBeenCalled();
    expect(customerRepository.save).not.toHaveBeenCalled();
    expect(result.payment.customerId).toBeUndefined();
    expect(result.payment.payerName).toBe('Visitante');
    expect(result.payment.payerEmail).toBe('guest@example.com');
  });

  it('creates or associates a customer when document is provided', async () => {
    const existingCustomer = Customer.create({
      storeId: 'store-1',
      name: 'Cliente',
      email: 'cliente@example.com',
      document: new Document('52998224725'),
    });

    const paymentRepository = {
      externalIdExists: vi.fn().mockResolvedValue(false),
      save: vi.fn(),
    };

    const customerRepository = {
      findByExternalId: vi.fn(),
      findByDocument: vi.fn().mockResolvedValue(existingCustomer),
      save: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CreatePaymentUseCase(
      paymentRepository as any,
      customerRepository as any,
      { findById: vi.fn().mockResolvedValue(store) } as any,
      { save: vi.fn() } as any,
      pixQrCodeGenerator as any,
      expirationQueue as any,
      feePolicy as any,
      'test@hockpay.com',
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      amount: 7990,
      customer: {
        document: '52998224725',
      },
      environment: Environment.TEST,
    });

    expect(customerRepository.findByDocument).toHaveBeenCalled();
    expect(result.payment.customerId).toBe(existingCustomer.id);
    expect(result.payment.payerDocument).toBe('52998224725');
    expect(result.payment.payerName).toBe('Cliente');
    expect(result.payment.payerEmail).toBe('cliente@example.com');
  });

  it('does not create a customer for checkout-session doc-only payments', async () => {
    const paymentRepository = {
      externalIdExists: vi.fn().mockResolvedValue(false),
      save: vi.fn(),
    };

    const customerRepository = {
      findByExternalId: vi.fn(),
      findByDocument: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CreatePaymentUseCase(
      paymentRepository as any,
      customerRepository as any,
      { findById: vi.fn().mockResolvedValue(store) } as any,
      { save: vi.fn() } as any,
      pixQrCodeGenerator as any,
      expirationQueue as any,
      feePolicy as any,
      'test@hockpay.com',
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      amount: 7990,
      customer: {
        document: '52998224725',
      },
      customerPromotionPolicy: CustomerPromotionPolicy.CHECKOUT_SESSION,
      environment: Environment.TEST,
    });

    expect(customerRepository.findByDocument).toHaveBeenCalled();
    expect(customerRepository.save).not.toHaveBeenCalled();
    expect(result.payment.customerId).toBeUndefined();
    expect(result.payment.payerDocument).toBe('52998224725');
  });

  it('creates a customer for checkout-session payments when document and name are provided', async () => {
    const paymentRepository = {
      externalIdExists: vi.fn().mockResolvedValue(false),
      save: vi.fn(),
    };

    const customerRepository = {
      findByExternalId: vi.fn(),
      findByDocument: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CreatePaymentUseCase(
      paymentRepository as any,
      customerRepository as any,
      { findById: vi.fn().mockResolvedValue(store) } as any,
      { save: vi.fn() } as any,
      pixQrCodeGenerator as any,
      expirationQueue as any,
      feePolicy as any,
      'test@hockpay.com',
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      amount: 7990,
      customer: {
        document: '52998224725',
        name: 'Cliente checkout',
      },
      customerPromotionPolicy: CustomerPromotionPolicy.CHECKOUT_SESSION,
      environment: Environment.TEST,
    });

    expect(customerRepository.save).toHaveBeenCalledTimes(1);
    expect(result.customerCreated).toBe(true);
    expect(result.payment.customerId).toBeDefined();
  });

  it('reuses and enriches a customer found by externalId', async () => {
    const existingCustomer = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_123',
      document: new Document('52998224725'),
    });

    const paymentRepository = {
      externalIdExists: vi.fn().mockResolvedValue(false),
      save: vi.fn(),
    };

    const customerRepository = {
      findByExternalId: vi.fn().mockResolvedValue(existingCustomer),
      findByDocument: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CreatePaymentUseCase(
      paymentRepository as any,
      customerRepository as any,
      { findById: vi.fn().mockResolvedValue(store) } as any,
      { save: vi.fn() } as any,
      pixQrCodeGenerator as any,
      expirationQueue as any,
      feePolicy as any,
      'test@hockpay.com',
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      amount: 7990,
      customer: {
        externalId: 'cust_123',
        name: 'Cliente',
        email: 'cliente@example.com',
      },
      customerPromotionPolicy: CustomerPromotionPolicy.CHECKOUT_SESSION,
      environment: Environment.TEST,
    });

    expect(customerRepository.findByExternalId).toHaveBeenCalledWith(
      'store-1',
      'cust_123',
    );
    expect(customerRepository.update).toHaveBeenCalledTimes(1);
    expect(result.payment.customerId).toBe(existingCustomer.id);
    expect(result.payment.payerName).toBe('Cliente');
  });

  it('rejects conflicting externalId and document matches in checkout-session promotion', async () => {
    const customerByExternalId = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_123',
      document: new Document('52998224725'),
    });
    const customerByDocument = Customer.create({
      storeId: 'store-1',
      externalId: 'cust_999',
      document: new Document('11144477735'),
    });

    const customerRepository = {
      findByExternalId: vi.fn().mockResolvedValue(customerByExternalId),
      findByDocument: vi.fn().mockResolvedValue(customerByDocument),
      save: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CreatePaymentUseCase(
      {
        externalIdExists: vi.fn().mockResolvedValue(false),
        save: vi.fn(),
      } as any,
      customerRepository as any,
      { findById: vi.fn().mockResolvedValue(store) } as any,
      { save: vi.fn() } as any,
      pixQrCodeGenerator as any,
      expirationQueue as any,
      feePolicy as any,
      'test@hockpay.com',
    );

    await expect(
      useCase.execute({
        storeId: 'store-1',
        amount: 7990,
        customer: {
          externalId: 'cust_123',
          document: '11144477735',
        },
        customerPromotionPolicy: CustomerPromotionPolicy.CHECKOUT_SESSION,
        environment: Environment.TEST,
      }),
    ).rejects.toBeInstanceOf(CustomerIdentityConflictError);
  });
});
