import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * Input DTO for GetCheckoutPaymentUseCase.
 */
export interface IGetCheckoutPaymentInput {
  token: string;
}

/**
 * Output DTO for GetCheckoutPaymentUseCase.
 * Contains only safe data for public checkout page.
 */
export interface ICheckoutPaymentOutput {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  status: PaymentStatus;
  environment: Environment;
  pixQrCode: string;
  pixCopyPaste: string;
  successUrl?: string;
  cancelUrl?: string;
  expiresAt: Date;
  paidAt?: Date;
  createdAt: Date;
}

/**
 * Use Case: Get Checkout Payment
 *
 * This use case retrieves payment data for the public checkout page.
 * It only returns safe data that can be exposed publicly.
 *
 * The checkout token is a unique, hard-to-guess identifier that allows
 * customers to view their payment without authentication.
 */
export class GetCheckoutPaymentUseCase {
  constructor(private readonly paymentRepository: IPaymentRepository) { }

  async execute(input: IGetCheckoutPaymentInput): Promise<ICheckoutPaymentOutput> {
    const payment = await this.paymentRepository.findByCheckoutToken(input.token);

    if (!payment) {
      return null as never; // Will be handled by controller as 404
    }

    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      status: payment.status,
      environment: payment.environment,
      pixQrCode: payment.pixQrCode!,
      pixCopyPaste: payment.pixCopyPaste!,
      successUrl: payment.successUrl,
      cancelUrl: payment.cancelUrl,
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    };
  }
}
