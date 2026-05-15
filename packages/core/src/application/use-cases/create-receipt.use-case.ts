import { Receipt, ReceiptObject } from "../../domain/entities/receipt.entity";
import { IReceiptRepository } from "../../domain/repositories/receipt.repository.interface";
import { ReceiptNotFoundError } from "../../domain/errors/receipt-not-found.error";
import { buildReceiptNumber } from "./receipt-number";

/**
 * Input DTO for CreateReceiptUseCase.
 */
export interface ICreateReceiptInput {
  paymentId: string;
  customerId?: string;
  storeId: string;
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
  payeeName: string;
  payeeDocument?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency?: string;
  description?: string;
}

/**
 * Output DTO for CreateReceiptUseCase.
 */
export interface ICreateReceiptOutput {
  receipt: ReceiptObject;
}

/**
 * Use Case: Create Receipt
 *
 * Creates a payment receipt with an auto-generated sequential number.
 * The receipt number format is: RCP-YYYYMMDD-STOREID-XXXXX
 *
 * Business rules:
 * - Receipt number is generated atomically using a counter table
 * - Receipt is created in ISSUED status
 * - Snapshot data is captured (payer, payee, amounts)
 */
export class CreateReceiptUseCase {
  constructor(private readonly receiptRepository: IReceiptRepository) {}

  async execute(input: ICreateReceiptInput): Promise<ICreateReceiptOutput> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const sequence = await this.receiptRepository.incrementCounter(
      input.storeId,
      dateStr,
    );

    const receiptNumber = buildReceiptNumber(
      input.storeId,
      dateStr,
      sequence,
    );

    const receipt = Receipt.create({
      receiptNumber,
      paymentId: input.paymentId,
      customerId: input.customerId,
      storeId: input.storeId,
      payerName: input.payerName,
      payerDocument: input.payerDocument,
      payerEmail: input.payerEmail,
      payeeName: input.payeeName,
      payeeDocument: input.payeeDocument,
      amount: input.amount,
      fee: input.fee,
      netAmount: input.netAmount,
      currency: input.currency,
      description: input.description,
    });

    await this.receiptRepository.save(receipt);

    return {
      receipt: receipt.toObject(),
    };
  }
}
