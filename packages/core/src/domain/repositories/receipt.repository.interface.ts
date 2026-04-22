/**
 * Repository Interface: Receipt
 *
 * Defines the contract for receipt persistence operations.
 */
import { Receipt } from "../entities/receipt.entity";

export interface IReceiptRepository {
  findById(id: string): Promise<Receipt | null>;
  findByPaymentId(paymentId: string): Promise<Receipt | null>;
  findByReceiptNumber(receiptNumber: string): Promise<Receipt | null>;
  findByStoreId(
    storeId: string,
    page?: number,
    limit?: number,
    filters?: {
      receiptNumber?: string;
      customerId?: string;
    },
  ): Promise<{ items: Receipt[]; total: number }>;
  save(receipt: Receipt): Promise<void>;
  update(receipt: Receipt): Promise<void>;
  incrementCounter(storeId: string, date: string): Promise<number>;
}
