import { describe, expect, it, vi } from 'vitest';
import { ExpirePaymentUseCase } from './expire-payment.use-case';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { InvalidPaymentStatusError } from '../../domain/errors/invalid-payment-status.error';
import { Environment } from '../../domain/value-objects/environment.vo';
import { PixCharge, PixChargeStatus } from '../../domain/entities/pix-charge.entity';

describe('ExpirePaymentUseCase', () => {
  function makePixCharge() {
    return PixCharge.create({
      storeId: 'store-1',
      amount: 7990,
      pixQrCode: 'qr',
      pixCopyPaste: 'copy',
      pixTxId: 'tx-1',
      expiresAt: new Date(Date.now() - 60_000),
    });
  }

  function makePayment(pixCharge?: PixCharge) {
    return Payment.create({
      storeId: 'store-1',
      pixChargeId: pixCharge?.id,
      pixCharge: pixCharge?.toObject(),
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      expiresAt: new Date(Date.now() - 60_000),
      environment: Environment.TEST,
    });
  }

  function makeUseCase(payment: Payment | null, pixCharge: PixCharge | null = null) {
    const repos = {
      paymentRepository: {
        findById: vi.fn().mockResolvedValue(payment),
        findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
        findByIdForUpdate: vi.fn().mockResolvedValue(payment),
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
      useCase: new ExpirePaymentUseCase(unitOfWork as any, expirationQueue as any),
    };
  }

  it('uses store-scoped lookup when storeId is provided', async () => {
    const payment = makePayment();
    const { useCase, repos } = makeUseCase(payment);

    await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
    });

    expect(repos.paymentRepository.findByIdAndStoreIdForUpdate).toHaveBeenCalledWith(
      payment.id,
      'store-1',
    );
    expect(repos.paymentRepository.findById).not.toHaveBeenCalled();
  });

  it('expires payment, PixCharge, and outbox in one UnitOfWork', async () => {
    const pixCharge = makePixCharge();
    const payment = makePayment(pixCharge);
    const { useCase, repos, unitOfWork, expirationQueue } = makeUseCase(
      payment,
      pixCharge,
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
      requestId: 'req-1',
    });

    expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
    expect(result.payment.status).toBe(PaymentStatus.EXPIRED);
    expect(result.payment.pixCharge?.status).toBe(PixChargeStatus.EXPIRED);
    expect(result.alreadyExpired).toBe(false);
    expect(repos.paymentRepository.update).toHaveBeenCalledWith(payment);
    expect(repos.pixChargeRepository.update).toHaveBeenCalledWith(pixCharge);

    const outboxEvent = repos.outboxWriter.save.mock.calls[0][0];
    expect(outboxEvent.eventType).toBe('payment.expired');
    expect(outboxEvent.requestId).toBe('req-1');
    expect(outboxEvent.payload).toMatchObject({
      id: payment.id,
      status: PaymentStatus.EXPIRED,
      pixCharge: {
        id: pixCharge.id,
        status: PixChargeStatus.EXPIRED,
      },
    });
    expect(expirationQueue.cancelExpiration).toHaveBeenCalledWith(payment.id);
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
        paymentId: payment.id,
      }),
    ).resolves.toMatchObject({
      payment: {
        id: payment.id,
        status: PaymentStatus.EXPIRED,
      },
      alreadyExpired: false,
    });
  });

  it('rejects non-pending payments when strictPending is enabled', async () => {
    const pixCharge = makePixCharge();
    const payment = makePayment(pixCharge);
    payment.confirm();
    const { useCase, repos, expirationQueue } = makeUseCase(payment, pixCharge);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: payment.id,
        strictPending: true,
      }),
    ).rejects.toBeInstanceOf(InvalidPaymentStatusError);

    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(repos.outboxWriter.save).not.toHaveBeenCalled();
    expect(expirationQueue.cancelExpiration).not.toHaveBeenCalled();
  });

  it('throws PaymentNotFoundError without cancelling expiration', async () => {
    const { useCase, expirationQueue } = makeUseCase(null);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: 'missing',
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);

    expect(expirationQueue.cancelExpiration).not.toHaveBeenCalled();
  });
});
