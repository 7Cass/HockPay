import { PaymentObject } from '../../domain/entities/payment.entity';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';

/**
 * Input DTO for FailPaymentUseCase.
 */
export interface IFailPaymentInput {
  storeId: string;
  paymentId: string;
  reason?: string;
}

/**
 * Output DTO for FailPaymentUseCase.
 */
export interface IFailPaymentOutput {
  payment: PaymentObject;
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
 */
export class FailPaymentUseCase {
  constructor(private readonly paymentRepository: IPaymentRepository) {}

  async execute(input: IFailPaymentInput): Promise<IFailPaymentOutput> {
    const payment = await this.paymentRepository.findByIdAndStoreId(
      input.paymentId,
      input.storeId,
    );

    if (!payment) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    // Attempt to fail - will throw InvalidPaymentStatusError if not PENDING
    const reason = input.reason ?? 'Payment failed';
    payment.fail(reason);

    await this.paymentRepository.update(payment);

    return {
      payment: payment.toObject(),
    };
  }
}
