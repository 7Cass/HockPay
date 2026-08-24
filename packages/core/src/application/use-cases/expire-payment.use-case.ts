import { PaymentObject } from '../../domain/entities/payment.entity';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { IExpirationQueuePort } from '../ports/expiration-queue.port';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { assertNotLiveEnvironment } from '../services/live-environment-guard';

/**
 * Input DTO for ExpirePaymentUseCase.
 */
export interface IExpirePaymentInput {
  storeId?: string;
  paymentId: string;
  requestId?: string;
  strictPending?: boolean;
  allowLiveEnvironment?: boolean;
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
    private readonly unitOfWork: IUnitOfWork,
    private readonly expirationQueue: IExpirationQueuePort,
  ) {}

  async execute(input: IExpirePaymentInput): Promise<IExpirePaymentOutput> {
    const result = await this.unitOfWork.execute(async (repos) => {
      const payment = input.storeId
        ? await repos.paymentRepository.findByIdAndStoreIdForUpdate(input.paymentId, input.storeId)
        : await repos.paymentRepository.findByIdForUpdate(input.paymentId);

      if (!payment) {
        throw new PaymentNotFoundError(input.paymentId);
      }

      if (!input.allowLiveEnvironment) {
        assertNotLiveEnvironment(payment.environment);
      }

      // Exact repeated expirations remain idempotent for queue retries.
      if (payment.status === PaymentStatus.EXPIRED) {
        return {
          payment: payment.toObject(),
          alreadyExpired: true,
        };
      }

      if (!payment.isPending()) {
        if (input.strictPending) {
          payment.expire();
        }

        return {
          payment: {
            ...payment.toObject(),
            pixCharge: payment.pixCharge,
          },
          alreadyExpired: false,
        };
      }

      // Only expire if pending
      let pixChargeObject = payment.pixCharge;
      payment.expire();
      await repos.paymentRepository.update(payment);

      if (payment.pixChargeId) {
        const pixCharge = await repos.pixChargeRepository.findByIdAndStoreIdForUpdate(
          payment.pixChargeId,
          payment.storeId,
        );
        if (pixCharge?.isOpen()) {
          pixCharge.expire();
          await repos.pixChargeRepository.update(pixCharge);
        }
        pixChargeObject = pixCharge?.toObject() ?? payment.pixCharge;
      }

      const paymentPayload = {
        ...payment.toObject(),
        pixCharge: pixChargeObject,
      };

      // Create outbox event for webhook notification
      const outboxEvent = OutboxEvent.create({
        aggregateType: 'Payment',
        aggregateId: payment.id,
        eventType: 'payment.expired',
        requestId: input.requestId,
        storeId: payment.storeId,
        payload: paymentPayload as unknown as Record<string, unknown>,
      });
      await repos.outboxWriter.save(outboxEvent);

      return {
        payment: paymentPayload,
        alreadyExpired: false,
      };
    });

    // Cancel any pending expiration job after the transaction commits.
    await this.cancelExpirationBestEffort(input.paymentId);

    return result;
  }

  private async cancelExpirationBestEffort(paymentId: string): Promise<void> {
    try {
      await this.expirationQueue.cancelExpiration(paymentId);
    } catch {
      // Queue cleanup should not roll back an already committed expiration.
    }
  }
}
