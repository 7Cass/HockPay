/**
 * Repository Interface: Receipt
 *
 * Defines the contract for receipt persistence operations.
 */
import { Receipt } from "../entities/receipt.entity";
import { Environment } from "../value-objects/environment.vo";

export interface ReceiptListFilters {
  receiptNumber?: string;
  customerId?: string;
  environment?: Environment;
}

export interface IReceiptRepository {
  findById(id: string): Promise<Receipt | null>;
  findByPaymentId(paymentId: string): Promise<Receipt | null>;
  findByReceiptNumber(receiptNumber: string): Promise<Receipt | null>;
  findByStoreId(
    storeId: string,
    page?: number,
    limit?: number,
    filters?: ReceiptListFilters,
  ): Promise<{ items: Receipt[]; total: number }>;
  save(receipt: Receipt): Promise<void>;
  update(receipt: Receipt): Promise<void>;
  incrementCounter(storeId: string, date: string): Promise<number>;
}
