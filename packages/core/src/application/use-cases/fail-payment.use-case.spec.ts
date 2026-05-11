import { describe, expect, it, vi } from 'vitest';
import { FailPaymentUseCase } from './fail-payment.use-case';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { InvalidPaymentStatusError } from '../../domain/errors/invalid-payment-status.error';
import { Environment } from '../../domain/value-objects/environment.vo';

describe('FailPaymentUseCase', () => {
  function makePayment() {
    return Payment.create({
      storeId: 'store-1',
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.TEST,
    });
  }

  function makeUseCase(payment: Payment | null) {
    const paymentRepository = {
      findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
      update: vi.fn(),
    };
    const outboxWriter = {
      save: vi.fn(),
    };
    const expirationQueue = {
      scheduleExpiration: vi.fn(),
      cancelExpiration: vi.fn(),
    };

    return {
      paymentRepository,
      outboxWriter,
      expirationQueue,
      useCase: new FailPaymentUseCase(
        paymentRepository as any,
        outboxWriter as any,
        expirationQueue as any,
      ),
    };
  }

  it('throws PaymentNotFoundError when payment does not exist and does not cancel expiration', async () => {
    const { useCase, paymentRepository, outboxWriter, expirationQueue } =
      makeUseCase(null);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: 'payment-1',
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);

    expect(paymentRepository.update).not.toHaveBeenCalled();
    expect(outboxWriter.save).not.toHaveBeenCalled();
    expect(expirationQueue.cancelExpiration).not.toHaveBeenCalled();
  });

  it('fails a pending payment, saves payment.failed outbox, and cancels expiration', async () => {
    const payment = makePayment();
    const { useCase, paymentRepository, outboxWriter, expirationQueue } =
      makeUseCase(payment);

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
      reason: 'Payment declined',
    });

    expect(result.payment.status).toBe(PaymentStatus.FAILED);
    expect(result.payment.failedReason).toBe('Payment declined');
    expect(paymentRepository.update).toHaveBeenCalledWith(payment);
    expect(outboxWriter.save).toHaveBeenCalledTimes(1);

    const outboxEvent = outboxWriter.save.mock.calls[0][0];
    expect(outboxEvent.aggregateType).toBe('Payment');
    expect(outboxEvent.aggregateId).toBe(payment.id);
    expect(outboxEvent.eventType).toBe('payment.failed');
    expect(outboxEvent.payload).toMatchObject({
      id: payment.id,
      status: PaymentStatus.FAILED,
      failedReason: 'Payment declined',
    });
    expect(expirationQueue.cancelExpiration).toHaveBeenCalledWith(payment.id);
  });

  it('returns an already failed payment without duplicating persistence or outbox', async () => {
    const payment = makePayment();
    payment.fail('Payment declined');
    const { useCase, paymentRepository, outboxWriter, expirationQueue } =
      makeUseCase(payment);

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
      reason: 'Retry failure',
    });

    expect(result.alreadyFailed).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.FAILED);
    expect(result.payment.failedReason).toBe('Payment declined');
    expect(paymentRepository.update).not.toHaveBeenCalled();
    expect(outboxWriter.save).not.toHaveBeenCalled();
    expect(expirationQueue.cancelExpiration).toHaveBeenCalledWith(payment.id);
  });

  it('keeps domain error for invalid status and does not create outbox or cancel expiration', async () => {
    const payment = makePayment();
    payment.confirm();
    const { useCase, paymentRepository, outboxWriter, expirationQueue } =
      makeUseCase(payment);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: payment.id,
        reason: 'Payment declined',
      }),
    ).rejects.toBeInstanceOf(InvalidPaymentStatusError);

    expect(paymentRepository.update).not.toHaveBeenCalled();
    expect(outboxWriter.save).not.toHaveBeenCalled();
    expect(expirationQueue.cancelExpiration).not.toHaveBeenCalled();
  });
});
