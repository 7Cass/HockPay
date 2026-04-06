import { Refund, RefundObject } from "../../domain/entities/refund.entity";
import { Payment, PaymentObject } from "../../domain/entities/payment.entity";
import { IRefundRepository } from "../../domain/repositories/refund.repository.interface";
import { IPaymentRepository } from "../../domain/repositories/payment.repository.interface";
import { IAccountRepository } from "../../domain/repositories/account.repository.interface";
import { ITransactionRepository } from "../../domain/repositories/transaction.repository.interface";
import { IOutboxWriter } from "../../domain/repositories/outbox-writer.repository.interface";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import {
  Transaction,
  TransactionType,
} from "../../domain/entities/transaction.entity";
import { PaymentNotFoundError } from "../../domain/errors/payment-not-found.error";
import { InvalidRefundAmountError } from "../../domain/errors/invalid-refund-amount.error";
import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";

export interface ICreateRefundInput {
  storeId: string;
  paymentId: string;
  amount: number;
  reason?: string;
}

export interface ICreateRefundOutput {
  refund: RefundObject;
  payment: PaymentObject;
}

export class CreateRefundUseCase {
  constructor(
    private readonly refundRepository: IRefundRepository,
    private readonly paymentRepository: IPaymentRepository,
    private readonly accountRepository: IAccountRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly outboxWriter: IOutboxWriter,
  ) {}

  async execute(input: ICreateRefundInput): Promise<ICreateRefundOutput> {
    const payment = await this.paymentRepository.findByIdAndStoreId(
      input.paymentId,
      input.storeId,
    );

    if (!payment) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    if (!payment.isConfirmed() && !payment.isReleased()) {
      throw new InvalidRefundAmountError(
        "Can only refund confirmed or released payments",
      );
    }

    const remainingRefundable = payment.amount - payment.totalRefunded;

    if (input.amount <= 0) {
      throw new InvalidRefundAmountError("Refund amount must be positive");
    }

    if (input.amount > remainingRefundable) {
      throw new InvalidRefundAmountError(
        `Refund amount exceeds remaining refundable amount (${remainingRefundable} cents)`,
      );
    }

    const feeRefunded = Math.round(
      payment.fee * (input.amount / payment.amount),
    );

    const refund = Refund.create({
      paymentId: payment.id,
      amount: input.amount,
      feeRefunded,
      reason: input.reason,
    });

    await this.refundRepository.save(refund);

    payment.addRefund(input.amount);
    await this.paymentRepository.update(payment);

    const account = await this.accountRepository.findByStoreId(input.storeId);
    if (!account) {
      throw new AccountNotFoundError(input.storeId);
    }

    account.deductFromBlocked(input.amount);
    await this.accountRepository.update(account);

    const transaction = Transaction.create({
      accountId: account.id,
      type: TransactionType.REFUND_DEDUCTED,
      amount: input.amount,
      fee: feeRefunded,
      netAmount: input.amount - feeRefunded,
      balanceAfter: account.totalBalance,
      referenceType: "REFUND",
      referenceId: refund.id,
      description: `Estorno parcial (#${refund.id.split("-")[0]})`,
    });
    await this.transactionRepository.save(transaction);

    const outboxEvent = OutboxEvent.create({
      aggregateType: "Payment",
      aggregateId: payment.id,
      eventType: "payment.refunded",
      payload: payment.toObject() as unknown as Record<string, unknown>,
    });
    await this.outboxWriter.save(outboxEvent);

    return {
      refund: refund.toObject(),
      payment: payment.toObject(),
    };
  }
}
