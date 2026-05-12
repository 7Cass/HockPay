import { PaymentObject } from '../../domain/entities/payment.entity';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { IOutboxWriter } from '../../domain/repositories/outbox-writer.repository.interface';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { IExpirationQueuePort } from '../ports/expiration-queue.port';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';

/**
 * Input DTO for FailPaymentUseCase.
 */
export interface IFailPaymentInput {
  storeId: string;
  paymentId: string;
  requestId?: string;
  reason?: string;
}

/**
 * Output DTO for FailPaymentUseCase.
 */
export interface IFailPaymentOutput {
  payment: PaymentObject;
  alreadyFailed?: boolean;
}

/**
 * Use Case: Fail Payment
 *
 * This use case handles failing a payment.
 * Used by the dev/simulate endpoint.
 *
 * Business rules:
 * - Payment must exist and belong to the store
 * - Payment must be in PENDING status
 * - A reason for the failure should be provided
 * - Outbox event is created for webhook notification
 */
export class FailPaymentUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly outboxWriter: IOutboxWriter,
    private readonly expirationQueue: IExpirationQueuePort,
  ) {}

  async execute(input: IFailPaymentInput): Promise<IFailPaymentOutput> {
    const payment = await this.paymentRepository.findByIdAndStoreId(
      input.paymentId,
      input.storeId,
    );

    if (!payment) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    if (payment.status === PaymentStatus.FAILED) {
      await this.expirationQueue.cancelExpiration(payment.id);

      return {
        payment: payment.toObject(),
        alreadyFailed: true,
      };
    }

    // Attempt to fail - will throw InvalidPaymentStatusError if not PENDING
    const reason = input.reason ?? 'Payment failed';
    payment.fail(reason);

    await this.paymentRepository.update(payment);

    // Create outbox event for webhook notification
    // Note: The failedReason is already set on the payment entity via payment.fail(reason)
    const outboxEvent = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: payment.id,
      eventType: 'payment.failed',
      requestId: input.requestId,
      storeId: payment.storeId,
      payload: payment.toObject() as unknown as Record<string, unknown>,
    });
    await this.outboxWriter.save(outboxEvent);

    await this.expirationQueue.cancelExpiration(payment.id);

    return {
      payment: payment.toObject(),
    };
  }
}
