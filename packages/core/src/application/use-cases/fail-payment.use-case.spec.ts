import { describe, expect, it, vi } from 'vitest';
import { FailPaymentUseCase } from './fail-payment.use-case';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { InvalidPaymentStatusError } from '../../domain/errors/invalid-payment-status.error';
import { Environment } from '../../domain/value-objects/environment.vo';
import { PixCharge, PixChargeStatus } from '../../domain/entities/pix-charge.entity';

describe('FailPaymentUseCase', () => {
  function makePayment(pixCharge?: PixCharge) {
    return Payment.create({
      storeId: 'store-1',
      pixChargeId: pixCharge?.id,
      pixCharge: pixCharge?.toObject(),
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      expiresAt: new Date(Date.now() + 60_000),
      environment: Environment.TEST,
    });
  }

  function makePixCharge() {
    return PixCharge.create({
      storeId: 'store-1',
      amount: 7990,
      pixQrCode: 'qr',
      pixCopyPaste: 'copy',
      pixTxId: 'tx-1',
      expiresAt: new Date(Date.now() + 60_000),
    });
  }

  function makeUseCase(payment: Payment | null, pixCharge: PixCharge | null = null) {
    const repos = {
      paymentRepository: {
        findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
        findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(payment),
        update: vi.fn(),
      },
      pixChargeRepository: {
        findByIdAndStoreId: vi.fn().mockResolvedValue(pixCharge),
        findByIdAndStoreIdForUpdate: vi.fn().mockResolvedValue(pixCharge),
        update: vi.fn(),
      },
      outboxWriter: {
        save: vi.fn(),
      },
    };
    const unitOfWork = {
      execute: vi.fn(async (work: any) => work(repos)),
    };
    const expirationQueue = {
      scheduleExpiration: vi.fn(),
      cancelExpiration: vi.fn(),
    };

    return {
      repos,
      unitOfWork,
      expirationQueue,
      useCase: new FailPaymentUseCase(unitOfWork as any, expirationQueue as any),
    };
  }

  it('throws PaymentNotFoundError when payment does not exist and does not cancel expiration', async () => {
    const { useCase, repos, expirationQueue } = makeUseCase(null);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: 'payment-1',
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);

    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(repos.outboxWriter.save).not.toHaveBeenCalled();
    expect(expirationQueue.cancelExpiration).not.toHaveBeenCalled();
  });

  it('fails a pending payment, saves payment.failed outbox, and cancels expiration after commit', async () => {
    const pixCharge = makePixCharge();
    const payment = makePayment(pixCharge);
    const { useCase, repos, unitOfWork, expirationQueue } = makeUseCase(
      payment,
      pixCharge,
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
      reason: 'Payment declined',
    });

    expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
    expect(repos.paymentRepository.findByIdAndStoreIdForUpdate).toHaveBeenCalledWith(
      payment.id,
      'store-1',
    );
    expect(result.payment.status).toBe(PaymentStatus.FAILED);
    expect(result.payment.failedReason).toBe('Payment declined');
    expect(result.payment.pixCharge?.status).toBe(PixChargeStatus.CANCELLED);
    expect(repos.paymentRepository.update).toHaveBeenCalledWith(payment);
    expect(repos.pixChargeRepository.update).toHaveBeenCalledWith(pixCharge);
    expect(repos.outboxWriter.save).toHaveBeenCalledTimes(1);

    const outboxEvent = repos.outboxWriter.save.mock.calls[0][0];
    expect(outboxEvent.aggregateType).toBe('Payment');
    expect(outboxEvent.aggregateId).toBe(payment.id);
    expect(outboxEvent.eventType).toBe('payment.failed');
    expect(outboxEvent.payload).toMatchObject({
      id: payment.id,
      status: PaymentStatus.FAILED,
      failedReason: 'Payment declined',
      pixCharge: {
        id: pixCharge.id,
        status: PixChargeStatus.CANCELLED,
      },
    });
    expect(expirationQueue.cancelExpiration).toHaveBeenCalledWith(payment.id);
  });

  it('returns an already failed payment without duplicating persistence or outbox', async () => {
    const payment = makePayment();
    payment.fail('Payment declined');
    const { useCase, repos, expirationQueue } = makeUseCase(payment);

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
      reason: 'Retry failure',
    });

    expect(result.alreadyFailed).toBe(true);
    expect(result.payment.status).toBe(PaymentStatus.FAILED);
    expect(result.payment.failedReason).toBe('Payment declined');
    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(repos.outboxWriter.save).not.toHaveBeenCalled();
    expect(expirationQueue.cancelExpiration).toHaveBeenCalledWith(payment.id);
  });

  it('keeps domain error for invalid status and does not create outbox or cancel expiration', async () => {
    const payment = makePayment();
    payment.confirm();
    const { useCase, repos, expirationQueue } = makeUseCase(payment);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: payment.id,
        reason: 'Payment declined',
      }),
    ).rejects.toBeInstanceOf(InvalidPaymentStatusError);

    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(repos.outboxWriter.save).not.toHaveBeenCalled();
    expect(expirationQueue.cancelExpiration).not.toHaveBeenCalled();
  });

  it('does not cancel expiration when the transaction fails before commit', async () => {
    const pixCharge = makePixCharge();
    const payment = makePayment(pixCharge);
    const { useCase, repos, expirationQueue } = makeUseCase(payment, pixCharge);
    repos.outboxWriter.save.mockRejectedValueOnce(new Error('outbox failed'));

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: payment.id,
        reason: 'Payment declined',
      }),
    ).rejects.toThrow('outbox failed');

    expect(repos.paymentRepository.update).toHaveBeenCalledWith(payment);
    expect(repos.pixChargeRepository.update).toHaveBeenCalledWith(pixCharge);
    expect(expirationQueue.cancelExpiration).not.toHaveBeenCalled();
  });

  it('treats expiration cancellation as best-effort after commit', async () => {
    const payment = makePayment();
    const { useCase, expirationQueue } = makeUseCase(payment);
    expirationQueue.cancelExpiration.mockRejectedValueOnce(
      new Error('queue unavailable'),
    );

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: payment.id,
      }),
    ).resolves.toMatchObject({
      payment: {
        id: payment.id,
        status: PaymentStatus.FAILED,
      },
    });
  });
});
