import { PaymentObject } from '../../domain/entities/payment.entity';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { IOutboxWriter } from '../../domain/repositories/outbox-writer.repository.interface';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { IExpirationQueuePort } from '../ports/expiration-queue.port';

/**
 * Input DTO for ExpirePaymentUseCase.
 */
export interface IExpirePaymentInput {
  paymentId: string;
}

/**
 * Output DTO for ExpirePaymentUseCase.
 */
export interface IExpirePaymentOutput {
  payment: PaymentObject;
  alreadyExpired: boolean;
}

/**
 * Use Case: Expire Payment
 *
 * This use case handles expiring a payment.
 * Called by:
 * - BullMQ expiration job (scheduled)
 * - Dev simulate endpoint (manual)
 *
 * Business rules:
 * - Payment must exist
 * - If already in terminal state, do nothing (idempotent)
 * - Cancel any pending expiration job after expiring
 * - Outbox event is created for webhook notification
 */
export class ExpirePaymentUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly outboxWriter: IOutboxWriter,
    private readonly expirationQueue: IExpirationQueuePort,
  ) {}

  async execute(input: IExpirePaymentInput): Promise<IExpirePaymentOutput> {
    const payment = await this.paymentRepository.findById(input.paymentId);

    if (!payment) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    // If already in terminal state, return without changes (idempotent)
    if (payment.isTerminal()) {
      return {
        payment: payment.toObject(),
        alreadyExpired: true,
      };
    }

    // Only expire if pending
    if (payment.isPending()) {
      payment.expire();
      await this.paymentRepository.update(payment);

      // Create outbox event for webhook notification
      const outboxEvent = OutboxEvent.create({
        aggregateType: 'Payment',
        aggregateId: payment.id,
        eventType: 'payment.expired',
        payload: payment.toObject() as unknown as Record<string, unknown>,
      });
      await this.outboxWriter.save(outboxEvent);
    }

    // Cancel any pending expiration job
    await this.expirationQueue.cancelExpiration(input.paymentId);

    return {
      payment: payment.toObject(),
      alreadyExpired: false,
    };
  }
}
