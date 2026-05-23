import { Payment, PaymentMethod, PaymentObject } from "../../domain/entities/payment.entity";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import {
  PaymentLinkListItem,
  PaymentLinkStatus,
} from "../../domain/entities/payment-link.entity";
import {
  PixChargeObject,
  PixChargeStatus,
} from "../../domain/entities/pix-charge.entity";
import { Receipt } from "../../domain/entities/receipt.entity";
import {
  Transaction,
  TransactionType,
} from "../../domain/entities/transaction.entity";
import { Environment } from "../../domain/value-objects/environment.vo";
import {
  ITransactedRepositories,
  IUnitOfWork,
} from "../../domain/repositories/unit-of-work.interface";
import { IPaymentLinkRepository } from "../../domain/repositories/payment-link.repository.interface";
import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";
import { LiveEnvironmentNotAllowedError } from "../../domain/errors/live-environment-not-allowed.error";
import { FeePolicy } from "../services/fee-policy.service";
import { enrichPaymentAttempt } from "../services/payment-attempt-context.service";
import { ConfirmPaymentUseCase } from "./confirm-payment.use-case";
import { PaymentLinkNotFoundError } from "./get-payment-link.use-case";
import { PaymentLinkUnavailableError } from "./open-payment-link.use-case";
import { buildReceiptNumber } from "./receipt-number";

export interface IPayPaymentLinkInput {
  publicToken: string;
  requestId?: string;
  environment: Environment;
}

export interface IPayPaymentLinkOutput {
  payment: PaymentObject;
}

export class PayPaymentLinkUseCase {
  constructor(
    private readonly paymentLinkRepository: IPaymentLinkRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly feePolicy: FeePolicy,
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
  ) {}

  async execute(input: IPayPaymentLinkInput): Promise<IPayPaymentLinkOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const item = await repos.paymentLinkRepository.findPublicByTokenForUpdate(
        input.publicToken,
      );
      if (!item) throw new PaymentLinkNotFoundError(input.publicToken);

      this.ensureSimulationAllowed(input.environment, item.environment);
      this.ensurePayable(item.status, item.pixCharge.status);

      const pixCharge =
        await repos.pixChargeRepository.findByIdAndStoreIdForUpdate(
          item.pixCharge.id,
          item.storeId,
        );
      if (!pixCharge) {
        throw new PaymentLinkUnavailableError("Payment link Pix charge is invalid");
      }
      if (pixCharge.hasExpired()) {
        pixCharge.expire();
        await repos.pixChargeRepository.update(pixCharge);
        throw new PaymentLinkUnavailableError("Payment link has expired");
      }
      if (!pixCharge.isOpen()) {
        throw new PaymentLinkUnavailableError("Payment link is not payable");
      }

      const store = await repos.storeRepository.findById(item.storeId);
      if (!store) throw new PaymentLinkUnavailableError("Payment link store is invalid");

      const payment = this.createAttempt(input, item, pixCharge.toObject(), store);

      await repos.paymentRepository.save(payment);
      const createdPayload = await this.buildPaymentPayload(
        repos,
        payment,
        pixCharge.toObject(),
      );

      const createdOutboxEvent = OutboxEvent.create({
        aggregateType: "Payment",
        aggregateId: payment.id,
        eventType: "payment.created",
        requestId: input.requestId,
        storeId: payment.storeId,
        payload: createdPayload as unknown as Record<string, unknown>,
      });
      await repos.outboxWriter.save(createdOutboxEvent);

      payment.confirm();

      const account = await repos.accountRepository.findByStoreIdForUpdate(
        item.storeId,
      );
      if (!account) {
        throw new AccountNotFoundError(item.storeId);
      }

      account.addToPending(payment.netAmount);
      await repos.accountRepository.update(account);

      pixCharge.markPaid();
      await repos.pixChargeRepository.update(pixCharge);
      await repos.paymentRepository.update(payment);

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

      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
      const sequence = await repos.receiptRepository.incrementCounter(
        item.storeId,
        dateStr,
      );
      const receiptNumber = buildReceiptNumber(
        item.storeId,
        dateStr,
        sequence,
      );

      const receipt = Receipt.create({
        receiptNumber,
        paymentId: payment.id,
        storeId: item.storeId,
        payeeName: store.name,
        amount: payment.amount,
        fee: payment.fee,
        netAmount: payment.netAmount,
        currency: payment.currency,
        description: payment.description,
      });
      await repos.receiptRepository.save(receipt);

      const confirmedPayload = await this.buildPaymentPayload(
        repos,
        payment,
        pixCharge.toObject(),
      );

      const confirmedOutboxEvent = OutboxEvent.create({
        aggregateType: "Payment",
        aggregateId: payment.id,
        eventType: "payment.confirmed",
        requestId: input.requestId,
        storeId: payment.storeId,
        payload: confirmedPayload as unknown as Record<string, unknown>,
      });
      await repos.outboxWriter.save(confirmedOutboxEvent);

      return {
        payment: confirmedPayload,
      };
    });
  }

  private createAttempt(
    input: IPayPaymentLinkInput,
    item: PaymentLinkListItem,
    pixCharge: PixChargeObject,
    store: { feePercent: number; feeFixed: number },
  ): Payment {
    const feeResult = this.feePolicy.calculate({
      amountInCents: item.amount,
      feePercent: store.feePercent,
      feeFixed: store.feeFixed,
    });
    const paymentExpiresAt =
      pixCharge.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);

    return Payment.create({
      storeId: item.storeId,
      pixChargeId: pixCharge.id,
      amount: item.amount,
      fee: feeResult.feeInCents,
      netAmount: feeResult.netAmountInCents,
      currency: item.currency,
      description: item.description ?? item.title ?? undefined,
      environment: item.environment ?? input.environment,
      paymentMethod: PaymentMethod.PIX,
      pixCharge,
      expiresAt: paymentExpiresAt,
      metadata: {
        origin: "payment_link",
        paymentLinkId: item.id,
        internalReference: item.internalReference ?? undefined,
      },
    });
  }

  private async buildPaymentPayload(
    repos: ITransactedRepositories,
    payment: Payment,
    pixCharge: PixChargeObject,
  ): Promise<PaymentObject> {
    const relatedAttempts = payment.pixChargeId
      ? await repos.paymentRepository.findByPixChargeIdAndStoreId(
          payment.pixChargeId,
          payment.storeId,
        )
      : [payment];
    const currentPayment = {
      ...payment.toObject(),
      pixCharge,
    };

    return enrichPaymentAttempt(
      currentPayment,
      relatedAttempts.map((attempt) =>
        attempt.id === payment.id ? currentPayment : attempt.toObject(),
      ),
    );
  }

  private ensureSimulationAllowed(
    requestEnvironment: Environment,
    linkEnvironment: Environment,
  ): void {
    if (
      requestEnvironment === Environment.LIVE ||
      linkEnvironment === Environment.LIVE
    ) {
      throw new LiveEnvironmentNotAllowedError();
    }
  }

  private ensurePayable(
    linkStatus: PaymentLinkStatus,
    pixChargeStatus: PixChargeStatus,
  ): void {
    if (
      (linkStatus !== "ACTIVE" && linkStatus !== "OPENED") ||
      pixChargeStatus !== PixChargeStatus.OPEN
    ) {
      throw new PaymentLinkUnavailableError("Payment link is not payable");
    }
  }
}
