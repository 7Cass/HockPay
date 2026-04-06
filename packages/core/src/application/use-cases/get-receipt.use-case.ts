import { Receipt, ReceiptObject } from "../../domain/entities/receipt.entity";
import { IReceiptRepository } from "../../domain/repositories/receipt.repository.interface";
import { ReceiptNotFoundError } from "../../domain/errors/receipt-not-found.error";

export interface IGetReceiptInput {
  receiptId?: string;
  paymentId?: string;
  storeId: string;
}

export interface IGetReceiptOutput {
  receipt: ReceiptObject;
}

export class GetReceiptUseCase {
  constructor(private readonly receiptRepository: IReceiptRepository) {}

  async execute(input: IGetReceiptInput): Promise<IGetReceiptOutput> {
    let receipt: Receipt | null = null;

    if (input.receiptId) {
      receipt = await this.receiptRepository.findById(input.receiptId);
    } else if (input.paymentId) {
      receipt = await this.receiptRepository.findByPaymentId(input.paymentId);
    }

    if (!receipt) {
      throw new ReceiptNotFoundError(input.receiptId || input.paymentId || "");
    }

    if (receipt.storeId !== input.storeId) {
      throw new ReceiptNotFoundError(input.receiptId || input.paymentId || "");
    }

    return {
      receipt: receipt.toObject(),
    };
  }
}
