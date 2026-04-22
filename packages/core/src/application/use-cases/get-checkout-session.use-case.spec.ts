import { describe, expect, it, vi } from 'vitest';
import { GetCheckoutSessionUseCase } from './get-checkout-session.use-case';
import {
  CheckoutSession,
  CustomerCollectionMode,
} from '../../domain/entities/checkout-session.entity';

describe('GetCheckoutSessionUseCase', () => {
  it('returns masked public customer input state without exposing raw prefill data', async () => {
    const session = CheckoutSession.create({
      storeId: 'store-1',
      amount: 7990,
      checkoutToken: 'token',
      customerCollectionMode: CustomerCollectionMode.IDENTIFIED,
      prefillCustomer: {
        externalId: 'cust_123',
        document: '52998224725',
        name: 'Joao Silva',
        email: 'joao@example.com',
      },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const useCase = new GetCheckoutSessionUseCase(
      {
        findByToken: vi.fn().mockResolvedValue(session),
        save: vi.fn(),
      } as any,
      {
        findById: vi.fn().mockResolvedValue({
          id: 'store-1',
          name: 'Hockpay Store',
        }),
      } as any,
      {
        findById: vi.fn(),
      } as any,
    );

    const result = await useCase.execute('token');

    expect(result.customerInputState).toEqual({
      hasDocument: true,
      hasName: true,
      hasEmail: true,
      maskedDocument: expect.any(String),
      maskedName: expect.any(String),
      maskedEmail: expect.any(String),
    });
    expect(result.customerInputState.maskedDocument).not.toBe('52998224725');
    expect(result.customerInputState.maskedName).not.toBe('Joao Silva');
    expect(result.customerInputState.maskedEmail).not.toBe('joao@example.com');
    expect((result as any).prefillCustomer).toBeUndefined();
  });
});
