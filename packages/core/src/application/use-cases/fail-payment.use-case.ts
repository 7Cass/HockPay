import { PaymentObject } from '../../domain/entities/payment.entity';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
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
  keepPixChargeOpen?: boolean;
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
    private readonly unitOfWork: IUnitOfWork,
    private readonly expirationQueue: IExpirationQueuePort,
  ) {}

  async execute(input: IFailPaymentInput): Promise<IFailPaymentOutput> {
    const result = await this.unitOfWork.execute(async (repos) => {
      const payment = await repos.paymentRepository.findByIdAndStoreId(
        input.paymentId,
        input.storeId,
      );

      if (!payment) {
        throw new PaymentNotFoundError(input.paymentId);
      }

      if (payment.status === PaymentStatus.FAILED) {
        return {
          payment: payment.toObject(),
          alreadyFailed: true,
        };
      }

      // Attempt to fail - will throw InvalidPaymentStatusError if not PENDING
      const reason = input.reason ?? 'Payment failed';
      payment.fail(reason);

      await repos.paymentRepository.update(payment);

      let pixChargeObject = payment.pixCharge;
      if (!input.keepPixChargeOpen && payment.pixChargeId) {
        const pixCharge = await repos.pixChargeRepository.findByIdAndStoreId(
          payment.pixChargeId,
          payment.storeId,
        );
        if (pixCharge?.isOpen()) {
          pixCharge.cancel();
          await repos.pixChargeRepository.update(pixCharge);
        }
        pixChargeObject = pixCharge?.toObject() ?? payment.pixCharge;
      }

      const paymentPayload = {
        ...payment.toObject(),
        pixCharge: pixChargeObject,
      };

      // Create outbox event for webhook notification
      // Note: The failedReason is already set on the payment entity via payment.fail(reason)
      const outboxEvent = OutboxEvent.create({
        aggregateType: 'Payment',
        aggregateId: payment.id,
        eventType: 'payment.failed',
        requestId: input.requestId,
        storeId: payment.storeId,
        payload: paymentPayload as unknown as Record<string, unknown>,
      });
      await repos.outboxWriter.save(outboxEvent);

      return {
        payment: paymentPayload,
      };
    });

    await this.cancelExpirationBestEffort(input.paymentId);

    return result;
  }

  private async cancelExpirationBestEffort(paymentId: string): Promise<void> {
    try {
      await this.expirationQueue.cancelExpiration(paymentId);
    } catch {
      // Queue cleanup should not roll back an already committed payment failure.
    }
  }
}
