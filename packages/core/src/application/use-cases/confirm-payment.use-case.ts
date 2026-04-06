import { PaymentObject } from "../../domain/entities/payment.entity";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import { PaymentNotFoundError } from "../../domain/errors/payment-not-found.error";
import { PaymentExpiredError } from "../../domain/errors/payment-expired.error";
import { InvalidPaymentStatusError } from "../../domain/errors/invalid-payment-status.error";
import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";
import {
  Transaction,
  TransactionType,
} from "../../domain/entities/transaction.entity";
import { Receipt } from "../../domain/entities/receipt.entity";

/**
 * Input DTO for ConfirmPaymentUseCase.
 */
export interface IConfirmPaymentInput {
  storeId: string;
  paymentId: string;
  pixTxId?: string;
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
}

/**
 * Output DTO for ConfirmPaymentUseCase.
 */
export interface IConfirmPaymentOutput {
  payment: PaymentObject;
}

/**
 * Use Case: Confirm Payment
 *
 * This use case handles confirming a payment (simulating Pix payment).
 * Used by the dev/simulate endpoint.
 *
 * Business rules:
 * - Payment must exist and belong to the store
 * - Payment must be in PENDING status
 * - Optional Pix transaction ID can be provided
 * - Validates the Account for the store
 * - Updates the pending balance atomically
 * - Records a Transaction in the ledger
 * - Creates a Receipt for the payment (always)
 * - Outbox event is created for webhook notification
 */
export class ConfirmPaymentUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IConfirmPaymentInput): Promise<IConfirmPaymentOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const payment = await repos.paymentRepository.findByIdAndStoreId(
        input.paymentId,
        input.storeId,
      );

      if (!payment) {
        throw new PaymentNotFoundError(input.paymentId);
      }

      // Check if expired (lazy check)
      if (payment.isPending() && payment.hasExpired()) {
        payment.expire();
        await repos.paymentRepository.update(payment);
        throw new PaymentExpiredError(input.paymentId);
      }

      // Attempt to confirm - will throw InvalidPaymentStatusError if not PENDING
      try {
        payment.confirm(input.pixTxId);
      } catch (error) {
        if (error instanceof InvalidPaymentStatusError) {
          throw error;
        }
        throw error;
      }

      // Fetch Account to update pending balance
      const account = await repos.accountRepository.findByStoreId(
        input.storeId,
      );
      if (!account) {
        throw new AccountNotFoundError(input.storeId);
      }

      // Update pending balance
      account.addToPending(payment.netAmount);
      await repos.accountRepository.update(account);

      // Save Payment update
      await repos.paymentRepository.update(payment);

      // Create Ledger Transaction
      const transaction = Transaction.create({
        accountId: account.id,
        type: TransactionType.PAYMENT_RECEIVED,
        amount: payment.amount,
        fee: payment.fee,
        netAmount: payment.netAmount,
        balanceAfter: account.totalBalance,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        description: `Pagamento recebido (#${payment.id.split("-")[0]})`,
      });
      await repos.transactionRepository.save(transaction);

      // Create Receipt (always)
      const store = await repos.storeRepository.findById(input.storeId);
      if (!store) {
        throw new Error(`Store not found: ${input.storeId}`);
      }

      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
      const sequence = await repos.receiptRepository.incrementCounter(
        input.storeId,
        dateStr,
      );
      const receiptNumber = `RCP-${dateStr}-${String(sequence).padStart(5, "0")}`;

      const receipt = Receipt.create({
        receiptNumber,
        paymentId: payment.id,
        storeId: input.storeId,
        payerName: input.payerName,
        payerDocument: input.payerDocument,
        payerEmail: input.payerEmail,
        payeeName: store.name,
        payeeDocument: undefined,
        amount: payment.amount,
        fee: payment.fee,
        netAmount: payment.netAmount,
        currency: payment.currency,
        description: payment.description,
      });
      await repos.receiptRepository.save(receipt);

      // Create outbox event for webhook notification
      const outboxEvent = OutboxEvent.create({
        aggregateType: "Payment",
        aggregateId: payment.id,
        eventType: "payment.confirmed",
        payload: payment.toObject() as unknown as Record<string, unknown>,
      });
      await repos.outboxWriter.save(outboxEvent);

      return {
        payment: payment.toObject(),
      };
    });
  }
}
