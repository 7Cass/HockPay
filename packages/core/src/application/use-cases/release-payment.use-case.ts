import { PaymentObject } from "../../domain/entities/payment.entity";
import { AccountObject } from "../../domain/entities/account.entity";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import {
  Transaction,
  TransactionType,
} from "../../domain/entities/transaction.entity";
import { PaymentNotFoundError } from "../../domain/errors/payment-not-found.error";
import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";
import { PaymentNotConfirmedError } from "../../domain/errors/payment-not-confirmed.error";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";

/**
 * Input DTO for ReleasePaymentUseCase.
 */
export interface IReleasePaymentInput {
  storeId?: string;
  paymentId: string;
  requestId?: string;
}

/**
 * Output DTO for ReleasePaymentUseCase.
 */
export interface IReleasePaymentOutput {
  payment: PaymentObject;
  account: AccountObject;
  alreadyReleased: boolean;
}

/**
 * Use Case: Release Payment
 *
 * This use case handles releasing funds from a confirmed payment.
 * Called by:
 * - Settlement job (scheduled)
 *
 * Business rules:
 * - Payment must exist
 * - Payment must be in CONFIRMED status
 * - Account must exist for the store
 * - Funds move from pending to available balance
 * - Outbox event is created for webhook notification
 * - Executed atomically via UnitOfWork
 */
export class ReleasePaymentUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IReleasePaymentInput): Promise<IReleasePaymentOutput> {
    return this.unitOfWork.execute(async (repos) => {
      // Find payment
      const payment = input.storeId
        ? await repos.paymentRepository.findByIdAndStoreIdForUpdate(
            input.paymentId,
            input.storeId,
          )
        : await repos.paymentRepository.findByIdForUpdate(input.paymentId);

      if (!payment) {
        throw new PaymentNotFoundError(input.paymentId);
      }

      if (payment.isReleased()) {
        const account = await repos.accountRepository.findByStoreId(
          payment.storeId,
        );

        if (!account) {
          throw new AccountNotFoundError(payment.storeId);
        }

        return {
          payment: payment.toObject(),
          account: account.toObject(),
          alreadyReleased: true,
        };
      }

      // Validate payment is confirmed
      if (!payment.isConfirmed()) {
        throw new PaymentNotConfirmedError(input.paymentId, payment.status);
      }

      // Find account
      const account = await repos.accountRepository.findByStoreIdForUpdate(
        payment.storeId,
      );

      if (!account) {
        throw new AccountNotFoundError(payment.storeId);
      }

      const processedRefunds = (
        await repos.refundRepository.findByPaymentId(payment.id)
      ).filter((refund) => refund.isProcessed());
      const refundedAmount = processedRefunds.reduce(
        (total, refund) => total + refund.amount,
        0,
      );
      const refundedFee = processedRefunds.reduce(
        (total, refund) => total + refund.feeRefunded,
        0,
      );
      const releaseAmount = payment.amount - refundedAmount;
      const releaseFee = payment.fee - refundedFee;
      const releaseNetAmount = releaseAmount - releaseFee;

      // Release the payment
      payment.release();
      await repos.paymentRepository.update(payment);

      // Move funds from pending to available
      account.releaseFromPending(releaseNetAmount);
      await repos.accountRepository.update(account);

      // Create transaction record
      const balanceAfter = account.available;
      const transaction = Transaction.create({
        accountId: account.id,
        type: TransactionType.PAYMENT_RELEASED,
        amount: releaseAmount,
        fee: releaseFee,
        netAmount: releaseNetAmount,
        balanceAfter,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        description: `Release of payment ${payment.id}`,
      });
      await repos.transactionRepository.save(transaction);

      // Create outbox event for webhook notification
      const outboxEvent = OutboxEvent.create({
        aggregateType: "Payment",
        aggregateId: payment.id,
        eventType: "payment.released",
        requestId: input.requestId,
        storeId: payment.storeId,
        payload: payment.toObject() as unknown as Record<string, unknown>,
      });
      await repos.outboxWriter.save(outboxEvent);

      return {
        payment: payment.toObject(),
        account: account.toObject(),
        alreadyReleased: false,
      };
    });
  }
}
