import { describe, expect, it, vi } from 'vitest';
import { CreateCheckoutSessionUseCase } from './create-checkout-session.use-case';
import { CustomerCollectionMode } from '../../domain/entities/checkout-session.entity';

function makeUseCase(onSave: (session: unknown) => void) {
  return new CreateCheckoutSessionUseCase(
    {
      execute: async (work: any) =>
        work({
          storeRepository: {
            findById: vi.fn().mockResolvedValue({
              id: 'store-1',
              isActive: true,
              isApproved: true,
            }),
          },
          productRepository: {},
          checkoutSessionRepository: {
            save: vi.fn(async (session: unknown) => {
              onSave(session);
            }),
          },
        }),
    } as any,
    {
      generateBase64: vi.fn().mockReturnValue('checkout-token'),
    } as any,
    'http://localhost:3333',
  );
}

describe('CreateCheckoutSessionUseCase', () => {
  it('defaults the customer collection mode to IDENTIFIED', async () => {
    let savedSession: any;
    const useCase = makeUseCase((session) => {
      savedSession = session;
    });

    const result = await useCase.execute({
      storeId: 'store-1',
      amount: 7990,
      description: 'Produto',
    });

    expect(savedSession.customerCollectionMode).toBe(
      CustomerCollectionMode.IDENTIFIED,
    );
    expect(result.customerCollectionMode).toBe(
      CustomerCollectionMode.IDENTIFIED,
    );
  });

  it('persists an explicit guest mode when provided', async () => {
    let savedSession: any;
    const useCase = makeUseCase((session) => {
      savedSession = session;
    });

    const result = await useCase.execute({
      storeId: 'store-1',
      amount: 7990,
      customerCollectionMode: CustomerCollectionMode.GUEST,
    });

    expect(savedSession.customerCollectionMode).toBe(
      CustomerCollectionMode.GUEST,
    );
    expect(result.customerCollectionMode).toBe(CustomerCollectionMode.GUEST);
  });

  it('persists and returns the prefilled customer data', async () => {
    let savedSession: any;
    const useCase = makeUseCase((session) => {
      savedSession = session;
    });

    const result = await useCase.execute({
      storeId: 'store-1',
      amount: 7990,
      prefillCustomer: {
        externalId: 'cust_123',
        document: '52998224725',
        name: 'Joao',
        email: 'joao@example.com',
      },
    });

    expect(savedSession.prefillCustomer).toEqual({
      externalId: 'cust_123',
      document: '52998224725',
      name: 'Joao',
      email: 'joao@example.com',
    });
    expect(result.prefillCustomer).toEqual({
      externalId: 'cust_123',
      document: '52998224725',
      name: 'Joao',
      email: 'joao@example.com',
    });
  });
});
