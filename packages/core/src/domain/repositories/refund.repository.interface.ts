/**
 * Repository Interface: Refund
 *
 * Defines the contract for refund persistence operations.
 */
import { Refund } from "../entities/refund.entity";

export interface IRefundRepository {
  findById(id: string): Promise<Refund | null>;
  findByPaymentId(paymentId: string): Promise<Refund[]>;
  save(refund: Refund): Promise<void>;
  update(refund: Refund): Promise<void>;
}
