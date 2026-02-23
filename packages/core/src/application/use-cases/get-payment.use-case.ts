import { PaymentObject } from '../../domain/entities/payment.entity';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';

/**
 * Input DTO for GetPaymentUseCase.
 */
export interface IGetPaymentInput {
  storeId: string;
  paymentId: string;
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
  constructor(private readonly paymentRepository: IPaymentRepository) {}

  async execute(input: IGetPaymentInput): Promise<IGetPaymentOutput> {
    const payment = await this.paymentRepository.findByIdAndStoreId(
      input.paymentId,
      input.storeId,
    );

    if (!payment) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    // Lazy expiration check: if pending and expired, expire it
    if (payment.isPending() && payment.hasExpired()) {
      payment.expire();
      await this.paymentRepository.update(payment);
    }

    return {
      payment: payment.toObject(),
    };
  }
}
