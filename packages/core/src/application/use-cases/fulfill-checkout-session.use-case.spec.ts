import { describe, expect, it, vi } from 'vitest';
import { FulfillCheckoutSessionUseCase } from './fulfill-checkout-session.use-case';
import {
  CheckoutSession,
  CustomerCollectionMode,
} from '../../domain/entities/checkout-session.entity';
import { Environment } from '../../domain/value-objects/environment.vo';

describe('FulfillCheckoutSessionUseCase', () => {
  it('rejects identified checkout sessions without a document', async () => {
    const session = CheckoutSession.create({
      storeId: 'store-1',
      amount: 7990,
      checkoutToken: 'token',
      customerCollectionMode: CustomerCollectionMode.IDENTIFIED,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const useCase = new FulfillCheckoutSessionUseCase(
      {
        findByToken: vi.fn().mockResolvedValue(session),
        save: vi.fn(),
      } as any,
      {
        execute: vi.fn(),
      } as any,
    );

    await expect(
      useCase.execute({
        token: 'token',
        customer: {},
        environment: Environment.TEST,
      }),
    ).rejects.toThrow('Customer document is required');
  });

  it('accepts guest checkout sessions without a document', async () => {
    const session = CheckoutSession.create({
      storeId: 'store-1',
      amount: 7990,
      checkoutToken: 'token',
      customerCollectionMode: CustomerCollectionMode.GUEST,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const createPaymentUseCase = {
      execute: vi.fn().mockResolvedValue({
        payment: {
          id: 'payment-1',
        },
      }),
    };

    const sessionRepository = {
      findByToken: vi.fn().mockResolvedValue(session),
      save: vi.fn(),
    };

    const useCase = new FulfillCheckoutSessionUseCase(
      sessionRepository as any,
      createPaymentUseCase as any,
    );

    const result = await useCase.execute({
      token: 'token',
      customer: { name: 'Visitante' },
      environment: Environment.TEST,
    });

    expect(createPaymentUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: { name: 'Visitante' },
      }),
    );
    expect(sessionRepository.save).toHaveBeenCalled();
    expect(result.paymentId).toBe('payment-1');
  });

  it('resolves hidden prefilled fields server-side before creating the payment', async () => {
    const session = CheckoutSession.create({
      storeId: 'store-1',
      amount: 7990,
      checkoutToken: 'token',
      customerCollectionMode: CustomerCollectionMode.IDENTIFIED,
      prefillCustomer: {
        externalId: 'cust_123',
        document: '52998224725',
        email: 'prefilled@example.com',
      },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const createPaymentUseCase = {
      execute: vi.fn().mockResolvedValue({
        payment: {
          id: 'payment-1',
        },
      }),
    };

    const useCase = new FulfillCheckoutSessionUseCase(
      {
        findByToken: vi.fn().mockResolvedValue(session),
        save: vi.fn(),
      } as any,
      createPaymentUseCase as any,
    );

    await useCase.execute({
      token: 'token',
      customer: {
        document: '11111111111',
        name: 'Comprador',
        email: 'override@example.com',
      },
      environment: Environment.TEST,
    });

    expect(createPaymentUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: {
          externalId: 'cust_123',
          document: '52998224725',
          name: 'Comprador',
          email: 'prefilled@example.com',
        },
      }),
    );
  });
});
