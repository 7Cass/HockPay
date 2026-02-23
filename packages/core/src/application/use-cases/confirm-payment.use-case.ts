import { PaymentObject } from '../../domain/entities/payment.entity';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { PaymentExpiredError } from '../../domain/errors/payment-expired.error';
import { InvalidPaymentStatusError } from '../../domain/errors/invalid-payment-status.error';

/**
 * Input DTO for ConfirmPaymentUseCase.
 */
export interface IConfirmPaymentInput {
  storeId: string;
  paymentId: string;
  pixTxId?: string;
}

/**
 * Output DTO for ConfirmPaymentUseCase.
 */
export interface IConfirmPaymentOutput {
  payment: PaymentObject;
}

/**
 * Use Case: Confirm Payment
 *
 * This use case handles confirming a payment (simulating Pix payment).
 * Used by the dev/simulate endpoint.
 *
 * Business rules:
 * - Payment must exist and belong to the store
 * - Payment must be in PENDING status
 * - Optional Pix transaction ID can be provided
 */
export class ConfirmPaymentUseCase {
  constructor(private readonly paymentRepository: IPaymentRepository) {}

  async execute(input: IConfirmPaymentInput): Promise<IConfirmPaymentOutput> {
    const payment = await this.paymentRepository.findByIdAndStoreId(
      input.paymentId,
      input.storeId,
    );

    if (!payment) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    // Check if expired (lazy check)
    if (payment.isPending() && payment.hasExpired()) {
      payment.expire();
      await this.paymentRepository.update(payment);
      throw new PaymentExpiredError(input.paymentId);
    }

    // Attempt to confirm - will throw InvalidPaymentStatusError if not PENDING
    try {
      payment.confirm(input.pixTxId);
    } catch (error) {
      if (error instanceof InvalidPaymentStatusError) {
        throw error;
      }
      throw error;
    }

    await this.paymentRepository.update(payment);

    return {
      payment: payment.toObject(),
    };
  }
}
