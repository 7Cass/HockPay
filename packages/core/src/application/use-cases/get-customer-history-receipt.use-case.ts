import { ReceiptObject } from '../../domain/entities/receipt.entity';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { ReceiptNotFoundError } from '../../domain/errors/receipt-not-found.error';
import { ICustomerRepository } from '../../domain/repositories/customer.repository.interface';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { IReceiptRepository } from '../../domain/repositories/receipt.repository.interface';
import { Environment } from '../../domain/value-objects/environment.vo';
import { resolveCustomerByExternalId } from './customer-history.helpers';

export interface IGetCustomerHistoryReceiptInput {
  storeId: string;
  customerExternalId: string;
  receiptId: string;
  environment: Environment;
}

export interface IGetCustomerHistoryReceiptOutput {
  receipt: ReceiptObject;
}

export class GetCustomerHistoryReceiptUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly paymentRepository: IPaymentRepository,
    private readonly receiptRepository: IReceiptRepository,
  ) {}

  async execute(
    input: IGetCustomerHistoryReceiptInput,
  ): Promise<IGetCustomerHistoryReceiptOutput> {
    const customer = await resolveCustomerByExternalId(
      this.customerRepository,
      input.storeId,
      input.customerExternalId,
    );

    const receipt = await this.receiptRepository.findById(input.receiptId);

    if (!receipt || receipt.storeId !== input.storeId) {
      throw new ReceiptNotFoundError(input.receiptId);
    }

    const payment = await this.paymentRepository.findByIdAndStoreId(
      receipt.paymentId,
      input.storeId,
    );

    if (!payment) {
      throw new PaymentNotFoundError(receipt.paymentId);
    }

    if (
      payment.customerId !== customer.id ||
      payment.environment !== input.environment
    ) {
      throw new ReceiptNotFoundError(input.receiptId);
    }

    return {
      receipt: receipt.toObject(),
    };
  }
}
