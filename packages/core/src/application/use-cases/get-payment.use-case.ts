import { PaymentObject } from '../../domain/entities/payment.entity';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * Input DTO for GetPaymentUseCase.
 */
export interface IGetPaymentInput {
  storeId: string;
  paymentId: string;
  requestId?: string;
  environment: Environment;
}

/**
 * Output DTO for GetPaymentUseCase.
 */
export interface IGetPaymentOutput {
  payment: PaymentObject;
}

/**
 * Use Case: Get Payment
 *
 * This use case handles fetching a payment by ID with lazy expiration check.
 *
 * Business rules:
 * - Payment must exist and belong to the store
 * - If payment is PENDING and has expired, it will be expired (lazy check)
 */
export class GetPaymentUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IGetPaymentInput): Promise<IGetPaymentOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const payment = await repos.paymentRepository.findByIdAndStoreIdForUpdate(
        input.paymentId,
        input.storeId,
      );

      if (!payment || payment.environment !== input.environment) {
        throw new PaymentNotFoundError(input.paymentId);
      }

      // Lazy expiration check: if pending and expired, expire it
      if (payment.isPending() && payment.hasExpired()) {
        payment.expire();
        if (payment.pixChargeId) {
          const charge = await repos.pixChargeRepository.findByIdAndStoreIdForUpdate(
            payment.pixChargeId,
            payment.storeId,
          );
          if (charge?.isOpen()) {
            charge.expire();
            await repos.pixChargeRepository.update(charge);
          }
        }
        await repos.paymentRepository.update(payment);

        const outboxEvent = OutboxEvent.create({
          aggregateType: 'Payment',
          aggregateId: payment.id,
          eventType: 'payment.expired',
          requestId: input.requestId,
          storeId: payment.storeId,
          payload: payment.toObject() as unknown as Record<string, unknown>,
        });
        await repos.outboxWriter.save(outboxEvent);
      }

      return {
        payment: payment.toObject(),
      };
    });
  }
}
