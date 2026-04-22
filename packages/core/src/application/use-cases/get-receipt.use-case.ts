import { Receipt, ReceiptObject } from "../../domain/entities/receipt.entity";
import { IReceiptRepository } from "../../domain/repositories/receipt.repository.interface";
import { ReceiptNotFoundError } from "../../domain/errors/receipt-not-found.error";

export interface IGetReceiptInput {
  receiptId?: string;
  paymentId?: string;
  receiptNumber?: string;
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
    } else if (input.receiptNumber) {
      receipt = await this.receiptRepository.findByReceiptNumber(
        input.receiptNumber,
      );
    }

    if (!receipt) {
      throw new ReceiptNotFoundError(
        input.receiptId || input.paymentId || input.receiptNumber || "",
      );
    }

    if (receipt.storeId !== input.storeId) {
      throw new ReceiptNotFoundError(
        input.receiptId || input.paymentId || input.receiptNumber || "",
      );
    }

    return {
      receipt: receipt.toObject(),
    };
  }
}
