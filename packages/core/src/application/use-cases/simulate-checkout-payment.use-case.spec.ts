import { describe, expect, it, vi } from 'vitest';
import { SimulateCheckoutPaymentUseCase } from './simulate-checkout-payment.use-case';
import { Payment } from '../../domain/entities/payment.entity';
import { CheckoutSession } from '../../domain/entities/checkout-session.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';

describe('SimulateCheckoutPaymentUseCase', () => {
  function makePayment(overrides: Partial<Parameters<typeof Payment.create>[0]> = {}) {
    return Payment.create({
      storeId: 'store-1',
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.TEST,
      ...overrides,
    });
  }

  function makeSession(payment: Payment | null, storeId = 'store-1') {
    return CheckoutSession.create({
      storeId,
      amount: 7990,
      checkoutToken: 'checkout-token',
      expiresAt: new Date(Date.now() + 60_000),
      status: 'COMPLETED',
      paymentId: payment?.id,
    });
  }

  function makeUseCase({
    payment = makePayment(),
    session,
  }: {
    payment?: Payment | null;
    session?: CheckoutSession | null;
  } = {}) {
    const resolvedSession = session === undefined ? makeSession(payment) : session;
    const confirmPaymentUseCase = {
      execute: vi.fn().mockResolvedValue({ payment: payment?.toObject() }),
    };
    const expirePaymentUseCase = {
      execute: vi.fn().mockResolvedValue({ payment: payment?.toObject() }),
    };
    const failPaymentUseCase = {
      execute: vi.fn().mockResolvedValue({ payment: payment?.toObject() }),
    };

    const useCase = new SimulateCheckoutPaymentUseCase(
      {
        findById: vi.fn().mockResolvedValue(payment),
      } as any,
      {
        findByToken: vi.fn().mockResolvedValue(resolvedSession),
      } as any,
      confirmPaymentUseCase as any,
      expirePaymentUseCase as any,
      failPaymentUseCase as any,
    );

    return {
      useCase,
      confirmPaymentUseCase,
      expirePaymentUseCase,
      failPaymentUseCase,
    };
  }

  it('requires a valid checkout token bound to the payment', async () => {
    const payment = makePayment();
    const { useCase } = makeUseCase({
      payment,
      session: null,
    });

    await expect(
      useCase.execute({
        paymentId: payment.id,
        checkoutToken: 'checkout-token',
        action: 'confirm',
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);
  });

  it('rejects sessions without a payment', async () => {
    const payment = makePayment();
    const { useCase } = makeUseCase({
      payment,
      session: makeSession(null),
    });

    await expect(
      useCase.execute({
        paymentId: payment.id,
        checkoutToken: 'checkout-token',
        action: 'confirm',
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);
  });

  it('rejects tokens bound to another payment', async () => {
    const payment = makePayment();
    const otherPayment = makePayment();
    const { useCase } = makeUseCase({
      payment,
      session: makeSession(otherPayment),
    });

    await expect(
      useCase.execute({
        paymentId: payment.id,
        checkoutToken: 'checkout-token',
        action: 'confirm',
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);
  });

  it('rejects payments from a different store than the checkout session', async () => {
    const payment = makePayment({ storeId: 'store-2' });
    const { useCase } = makeUseCase({
      payment,
      session: makeSession(payment, 'store-1'),
    });

    await expect(
      useCase.execute({
        paymentId: payment.id,
        checkoutToken: 'checkout-token',
        action: 'confirm',
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);
  });

  it('blocks live payments even with a valid checkout token', async () => {
    const payment = makePayment({ environment: Environment.LIVE });
    const { useCase } = makeUseCase({ payment });

    await expect(
      useCase.execute({
        paymentId: payment.id,
        checkoutToken: 'checkout-token',
        action: 'confirm',
      }),
    ).rejects.toBeInstanceOf(LiveEnvironmentNotAllowedError);
  });

  it('confirms a test payment only when token, payment, and store match', async () => {
    const payment = makePayment();
    const { useCase, confirmPaymentUseCase } = makeUseCase({ payment });

    await useCase.execute({
      paymentId: payment.id,
      checkoutToken: 'checkout-token',
      action: 'confirm',
    });

    expect(confirmPaymentUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentId: payment.id,
    });
  });

  it('delegates expire and fail with the validated payment context', async () => {
    const payment = makePayment();
    const { useCase, expirePaymentUseCase, failPaymentUseCase } = makeUseCase({
      payment,
    });

    await useCase.execute({
      paymentId: payment.id,
      checkoutToken: 'checkout-token',
      action: 'expire',
    });

    await useCase.execute({
      paymentId: payment.id,
      checkoutToken: 'checkout-token',
      action: 'fail',
    });

    expect(expirePaymentUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      paymentId: payment.id,
      strictPending: true,
    });
    expect(failPaymentUseCase.execute).toHaveBeenCalledWith({
      paymentId: payment.id,
      storeId: 'store-1',
      reason: 'Simulated failure',
    });
  });
});
