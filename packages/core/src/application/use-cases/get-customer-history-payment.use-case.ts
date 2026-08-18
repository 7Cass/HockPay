import { PaymentObject } from '../../domain/entities/payment.entity';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { Environment } from '../../domain/value-objects/environment.vo';
import { ICustomerRepository } from '../../domain/repositories/customer.repository.interface';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { resolveCustomerByExternalId } from './customer-history.helpers';

export interface IGetCustomerHistoryPaymentInput {
  storeId: string;
  customerExternalId: string;
  paymentId: string;
  environment: Environment;
}

export interface IGetCustomerHistoryPaymentOutput {
  payment: PaymentObject;
}

export class GetCustomerHistoryPaymentUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly paymentRepository: IPaymentRepository,
  ) {}

  async execute(
    input: IGetCustomerHistoryPaymentInput,
  ): Promise<IGetCustomerHistoryPaymentOutput> {
    const customer = await resolveCustomerByExternalId(
      this.customerRepository,
      input.storeId,
      input.customerExternalId,
    );

    const payment = await this.paymentRepository.findByIdAndStoreId(
      input.paymentId,
      input.storeId,
    );

    if (
      !payment ||
      payment.customerId !== customer.id ||
      payment.environment !== input.environment
    ) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    if (payment.isPending() && payment.hasExpired()) {
      payment.expire();
      await this.paymentRepository.update(payment);
    }

    return {
      payment: payment.toObject(),
    };
  }
}
