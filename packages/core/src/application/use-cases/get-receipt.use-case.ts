import { Receipt, ReceiptObject } from '../../domain/entities/receipt.entity';
import { IReceiptRepository } from '../../domain/repositories/receipt.repository.interface';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { ReceiptNotFoundError } from '../../domain/errors/receipt-not-found.error';
import { Environment } from '../../domain/value-objects/environment.vo';

export interface IGetReceiptInput {
  receiptId?: string;
  paymentId?: string;
  receiptNumber?: string;
  storeId: string;
  environment: Environment;
}

export interface IGetReceiptOutput {
  receipt: ReceiptObject;
}

export class GetReceiptUseCase {
  constructor(
    private readonly receiptRepository: IReceiptRepository,
    private readonly paymentRepository?: IPaymentRepository,
  ) {}

  async execute(input: IGetReceiptInput): Promise<IGetReceiptOutput> {
    let receipt: Receipt | null = null;

    if (input.receiptId) {
      receipt = await this.receiptRepository.findById(input.receiptId);
    } else if (input.paymentId) {
      receipt = await this.receiptRepository.findByPaymentId(input.paymentId);
    } else if (input.receiptNumber) {
      receipt = await this.receiptRepository.findByReceiptNumber(input.receiptNumber);
    }

    if (!receipt) {
      throw new ReceiptNotFoundError(
        input.receiptId || input.paymentId || input.receiptNumber || '',
      );
    }

    if (receipt.storeId !== input.storeId) {
      throw new ReceiptNotFoundError(
        input.receiptId || input.paymentId || input.receiptNumber || '',
      );
    }

    return {
      receipt: await this.toReceiptObject(receipt, input.environment),
    };
  }

  private async toReceiptObject(
    receipt: Receipt,
    environment: Environment,
  ): Promise<ReceiptObject> {
    const object = receipt.toObject();
    if (!this.paymentRepository) {
      throw new ReceiptNotFoundError(receipt.id);
    }
    const payment = await this.paymentRepository.findByIdAndStoreId(
      receipt.paymentId,
      receipt.storeId,
    );
    if (!payment || payment.environment !== environment) {
      throw new ReceiptNotFoundError(receipt.id);
    }
    return {
      ...object,
      items: payment.items ?? [],
    };
  }
}
