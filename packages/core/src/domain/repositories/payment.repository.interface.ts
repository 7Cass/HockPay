import { Payment } from "../entities/payment.entity";
import { LineItemObject } from "../entities/line-item.entity";
import { PaymentStatus } from "../enums/payment-status.enum";
import { Environment } from "../value-objects/environment.vo";

/**
 * Options for listing payments.
 */
export interface ListPaymentsOptions {
  storeId: string;
  page?: number;
  limit?: number;
  status?: PaymentStatus;
  customerId?: string;
  externalId?: string;
  startDate?: Date;
  endDate?: Date;
  environment?: Environment;
}

/**
 * Result of listing payments.
 */
export interface ListPaymentsResult {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interface for Payment Repository.
 *
 * This interface is defined in the domain layer and represents the contract
 * that any infrastructure implementation must follow.
 */
export interface IPaymentRepository {
  /**
   * Save a new payment to the repository.
   */
  save(payment: Payment): Promise<void>;

  /**
   * Persist immutable payment item snapshots for a payment.
   */
  saveItems(paymentId: string, items: LineItemObject[]): Promise<void>;

  /**
   * Find a payment by ID.
   * Returns null if not found.
   */
  findById(id: string): Promise<Payment | null>;

  /**
   * Find a payment by ID and lock it for update within the current transaction.
   * Returns null if not found.
   */
  findByIdForUpdate(id: string): Promise<Payment | null>;

  /**
   * Find a payment by ID and store ID.
   * This ensures the payment belongs to the store.
   * Returns null if not found or doesn't belong to the store.
   */
  findByIdAndStoreId(id: string, storeId: string): Promise<Payment | null>;

  findByIdsAndStoreId(ids: string[], storeId: string): Promise<Payment[]>;

  /**
   * Find a payment by ID and store ID and lock it for update within the current transaction.
   * Returns null if not found or doesn't belong to the store.
   */
  findByIdAndStoreIdForUpdate(
    id: string,
    storeId: string,
  ): Promise<Payment | null>;

  /**
   * Find a payment by external ID and store ID.
   * Returns null if not found.
   */
  findByExternalIdAndStoreId(
    externalId: string,
    storeId: string,
  ): Promise<Payment | null>;

  /**
   * Find a payment by Pix transaction ID.
   * Returns null if not found.
   */
  findByPixTxId(pixTxId: string): Promise<Payment | null>;

  /**
   * List payments with pagination and filters.
   */
  list(options: ListPaymentsOptions): Promise<ListPaymentsResult>;

  /**
   * List payments that belong to a Pix charge and store.
   */
  findByPixChargeIdAndStoreId(
    pixChargeId: string,
    storeId: string,
  ): Promise<Payment[]>;

  /**
   * List payments for multiple Pix charges in the same store.
   */
  listByPixChargeIdsAndStoreId(
    pixChargeIds: string[],
    storeId: string,
  ): Promise<Payment[]>;

  /**
   * Update a payment.
   */
  update(payment: Payment): Promise<void>;

  /**
   * Delete a payment by ID.
   */
  delete(id: string): Promise<void>;

  /**
   * Check if an external ID already exists for a store.
   */
  externalIdExists(externalId: string, storeId: string): Promise<boolean>;

  findConfirmedForSettlement(
    storeId: string,
    paidAtOnOrBefore: Date,
    take: number,
  ): Promise<Array<{ id: string }>>;

  findPendingExpired(
    now: Date,
    take: number,
  ): Promise<Array<{ id: string; storeId: string }>>;
}
