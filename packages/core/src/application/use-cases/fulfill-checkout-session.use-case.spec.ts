import { describe, expect, it, vi } from 'vitest';
import { FulfillCheckoutSessionUseCase } from './fulfill-checkout-session.use-case';
import {
  CheckoutSession,
  CustomerCollectionMode,
} from '../../domain/entities/checkout-session.entity';
import { Environment } from '../../domain/value-objects/environment.vo';

describe('FulfillCheckoutSessionUseCase', () => {
  function makeUseCase(
    session: CheckoutSession | null,
    overrides: {
      save?: ReturnType<typeof vi.fn>;
      createPayment?: Record<string, unknown>;
      claimOpenByToken?: ReturnType<typeof vi.fn>;
      findByToken?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const sessionRepository = {
      claimOpenByToken: overrides.claimOpenByToken ?? vi.fn().mockResolvedValue(session),
      findByToken: overrides.findByToken ?? vi.fn().mockResolvedValue(session),
      expireOpenByToken: vi.fn(),
      save: overrides.save ?? vi.fn(),
    };
    const unitOfWork = {
      execute: vi.fn((work) =>
        work({
          checkoutSessionRepository: sessionRepository,
        } as any),
      ),
    };
    const createPaymentUseCase = {
      execute: vi.fn(),
      executeInTransaction: vi.fn().mockResolvedValue({
        payment: {
          id: 'payment-1',
          expiresAt: session?.expiresAt ?? new Date(),
        },
        customerCreated: false,
      }),
      scheduleExpirationAfterCommit: vi.fn(),
      ...overrides.createPayment,
    };

    return {
      useCase: new FulfillCheckoutSessionUseCase(unitOfWork as any, createPaymentUseCase as any),
      unitOfWork,
      sessionRepository,
      createPaymentUseCase,
    };
  }

  it('rejects identified checkout sessions without a document', async () => {
    const session = CheckoutSession.create({
      storeId: 'store-1',
      amount: 7990,
      checkoutToken: 'token',
      customerCollectionMode: CustomerCollectionMode.IDENTIFIED,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const { useCase, createPaymentUseCase } = makeUseCase(session);

    await expect(
      useCase.execute({
        token: 'token',
        customer: {},
        environment: Environment.TEST,
      }),
    ).rejects.toThrow('Customer document is required');
    expect(createPaymentUseCase.executeInTransaction).not.toHaveBeenCalled();
  });

  it('accepts guest checkout sessions without a document', async () => {
    const session = CheckoutSession.create({
      storeId: 'store-1',
      amount: 7990,
      checkoutToken: 'token',
      customerCollectionMode: CustomerCollectionMode.GUEST,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const { useCase, sessionRepository, createPaymentUseCase, unitOfWork } = makeUseCase(session);

    const result = await useCase.execute({
      token: 'token',
      customer: { name: 'Visitante' },
      environment: Environment.TEST,
    });

    expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
    expect(createPaymentUseCase.execute).not.toHaveBeenCalled();
    expect(createPaymentUseCase.executeInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: { name: 'Visitante' },
      }),
      expect.any(Object),
    );
    expect(createPaymentUseCase.scheduleExpirationAfterCommit).toHaveBeenCalled();
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

    const { useCase, createPaymentUseCase } = makeUseCase(session);

    await useCase.execute({
      token: 'token',
      customer: {
        document: '11111111111',
        name: 'Comprador',
        email: 'override@example.com',
      },
      environment: Environment.TEST,
    });

    expect(createPaymentUseCase.executeInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: {
          externalId: 'cust_123',
          document: '52998224725',
          name: 'Comprador',
          email: 'prefilled@example.com',
        },
      }),
      expect.any(Object),
    );
  });

  it('does not create a payment when the session cannot be claimed', async () => {
    const completedSession = CheckoutSession.create({
      storeId: 'store-1',
      amount: 7990,
      checkoutToken: 'token',
      paymentId: 'payment-existing',
      status: 'COMPLETED',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { useCase, createPaymentUseCase } = makeUseCase(null, {
      findByToken: vi.fn().mockResolvedValue(completedSession),
    });

    const result = await useCase.execute({
      token: 'token',
      customer: { document: '52998224725' },
      environment: Environment.TEST,
    });

    expect(result).toEqual({
      sessionId: completedSession.id,
      paymentId: 'payment-existing',
    });
    expect(createPaymentUseCase.executeInTransaction).not.toHaveBeenCalled();
    expect(createPaymentUseCase.scheduleExpirationAfterCommit).not.toHaveBeenCalled();
  });

  it('does not schedule payment expiration when saving the fulfilled session fails', async () => {
    const session = CheckoutSession.create({
      storeId: 'store-1',
      amount: 7990,
      checkoutToken: 'token',
      customerCollectionMode: CustomerCollectionMode.GUEST,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { useCase, createPaymentUseCase } = makeUseCase(session, {
      save: vi.fn().mockRejectedValue(new Error('session save failed')),
    });

    await expect(
      useCase.execute({
        token: 'token',
        customer: { name: 'Visitante' },
        environment: Environment.TEST,
      }),
    ).rejects.toThrow('session save failed');

    expect(createPaymentUseCase.executeInTransaction).toHaveBeenCalledTimes(1);
    expect(createPaymentUseCase.scheduleExpirationAfterCommit).not.toHaveBeenCalled();
  });

  it('creates a single payment when the same checkout session is fulfilled twice', async () => {
    const session = CheckoutSession.create({
      storeId: 'store-1',
      amount: 7990,
      checkoutToken: 'token',
      customerCollectionMode: CustomerCollectionMode.GUEST,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const claimOpenByToken = vi.fn().mockResolvedValueOnce(session).mockResolvedValueOnce(null);
    const findByToken = vi.fn(async () => session);
    const { useCase, createPaymentUseCase } = makeUseCase(session, {
      claimOpenByToken,
      findByToken,
    });

    const first = await useCase.execute({
      token: 'token',
      customer: { name: 'Visitante' },
      environment: Environment.TEST,
    });
    const second = await useCase.execute({
      token: 'token',
      customer: { name: 'Visitante' },
      environment: Environment.TEST,
    });

    expect(first.paymentId).toBe('payment-1');
    expect(second.paymentId).toBe(first.paymentId);
    expect(createPaymentUseCase.executeInTransaction).toHaveBeenCalledTimes(1);
  });
});
