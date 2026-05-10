import { describe, expect, it, vi } from 'vitest';
import { GetPaymentUseCase } from './get-payment.use-case';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { Environment } from '../../domain/value-objects/environment.vo';

describe('GetPaymentUseCase', () => {
  function makePayment(expiresAt: Date): Payment {
    return Payment.create({
      storeId: 'store-1',
      amount: 7990,
      fee: 135,
      netAmount: 7855,
      expiresAt,
      environment: Environment.TEST,
    });
  }

  function makeUseCase(payment: Payment | null) {
    const repos = {
      paymentRepository: {
        findByIdAndStoreId: vi.fn().mockResolvedValue(payment),
        update: vi.fn(),
      },
      outboxWriter: {
        save: vi.fn(),
      },
      refundRepository: {} as any,
      accountRepository: {} as any,
      transactionRepository: {} as any,
      bankAccountRepository: {} as any,
      receiptRepository: {} as any,
      storeRepository: {} as any,
      customerRepository: {} as any,
    };

    const unitOfWork = {
      execute: vi.fn((work) => work(repos)),
    };

    return {
      repos,
      unitOfWork,
      useCase: new GetPaymentUseCase(unitOfWork as any),
    };
  }

  it('throws PaymentNotFoundError when payment does not exist', async () => {
    const { useCase, unitOfWork } = makeUseCase(null);

    await expect(
      useCase.execute({
        storeId: 'store-1',
        paymentId: 'payment-1',
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);

    expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
  });

  it('returns a pending non-expired payment without update or outbox', async () => {
    const payment = makePayment(new Date(Date.now() + 60_000));
    const { useCase, repos } = makeUseCase(payment);

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
    });

    expect(result.payment.status).toBe(PaymentStatus.PENDING);
    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(repos.outboxWriter.save).not.toHaveBeenCalled();
  });

  it('expires a pending expired payment and saves payment.expired outbox in the transaction', async () => {
    const payment = makePayment(new Date(Date.now() - 60_000));
    const { useCase, repos, unitOfWork } = makeUseCase(payment);

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
    });

    expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
    expect(result.payment.status).toBe(PaymentStatus.EXPIRED);
    expect(repos.paymentRepository.update).toHaveBeenCalledWith(payment);
    expect(repos.outboxWriter.save).toHaveBeenCalledTimes(1);

    const outboxEvent = repos.outboxWriter.save.mock.calls[0][0];
    expect(outboxEvent.aggregateType).toBe('Payment');
    expect(outboxEvent.aggregateId).toBe(payment.id);
    expect(outboxEvent.eventType).toBe('payment.expired');
    expect(outboxEvent.payload).toMatchObject({
      id: payment.id,
      status: PaymentStatus.EXPIRED,
    });
  });

  it('returns a terminal payment without creating a new outbox event', async () => {
    const payment = makePayment(new Date(Date.now() - 60_000));
    payment.expire();
    const { useCase, repos } = makeUseCase(payment);

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
    });

    expect(result.payment.status).toBe(PaymentStatus.EXPIRED);
    expect(repos.paymentRepository.update).not.toHaveBeenCalled();
    expect(repos.outboxWriter.save).not.toHaveBeenCalled();
  });
});
