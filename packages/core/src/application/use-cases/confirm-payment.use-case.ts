import { PaymentObject } from "../../domain/entities/payment.entity";
import { PaymentNotFoundError } from "../../domain/errors/payment-not-found.error";
import { PaymentExpiredError } from "../../domain/errors/payment-expired.error";
import { InvalidPaymentStatusError } from "../../domain/errors/invalid-payment-status.error";
import { PixChargeNotOpenError } from "../../domain/errors/pix-charge-not-open.error";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";
import { assertNotLiveEnvironment } from "../services/live-environment-guard";
import { settleConfirmedPayment } from "./settle-confirmed-payment";

/**
 * Input DTO for ConfirmPaymentUseCase.
 */
export interface IConfirmPaymentInput {
  storeId: string;
  paymentId: string;
  requestId?: string;
  pixTxId?: string;
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
      const payment = await repos.paymentRepository.findByIdAndStoreIdForUpdate(
        input.paymentId,
        input.storeId,
      );

      if (!payment) {
        throw new PaymentNotFoundError(input.paymentId);
      }

      assertNotLiveEnvironment(payment.environment);

      // Check if expired (lazy check)
      if (payment.isPending() && payment.hasExpired()) {
        payment.expire();
        if (payment.pixChargeId) {
          const charge =
            await repos.pixChargeRepository.findByIdAndStoreIdForUpdate(
              payment.pixChargeId,
              input.storeId,
            );
          charge?.expire();
          if (charge) await repos.pixChargeRepository.update(charge);
        }
        await repos.paymentRepository.update(payment);
        throw new PaymentExpiredError(input.paymentId);
      }

      const pixCharge = payment.pixChargeId
        ? await repos.pixChargeRepository.findByIdAndStoreIdForUpdate(
            payment.pixChargeId,
            input.storeId,
          )
        : null;

      if (payment.pixChargeId && !pixCharge) {
        throw new PixChargeNotOpenError(payment.pixChargeId);
      }

      if (pixCharge?.hasExpired()) {
        pixCharge.expire();
        await repos.pixChargeRepository.update(pixCharge);
        payment.expire();
        await repos.paymentRepository.update(payment);
        throw new PaymentExpiredError(input.paymentId);
      }

      if (pixCharge && !pixCharge.isOpen()) {
        throw new PixChargeNotOpenError(pixCharge.id, pixCharge.status);
      }

      payment.confirm();

      const paymentPayload = await settleConfirmedPayment(repos, {
        payment,
        pixCharge,
        storeId: input.storeId,
        requestId: input.requestId,
      });

      return {
        payment: paymentPayload,
      };
    });
  }
}
