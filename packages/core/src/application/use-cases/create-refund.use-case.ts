import { Refund, RefundObject } from '../../domain/entities/refund.entity';
import { PaymentObject } from '../../domain/entities/payment.entity';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { Transaction, TransactionType } from '../../domain/entities/transaction.entity';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { InvalidRefundAmountError } from '../../domain/errors/invalid-refund-amount.error';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';
import {
  ITransactedRepositories,
  IUnitOfWork,
} from '../../domain/repositories/unit-of-work.interface';
import { Environment } from '../../domain/value-objects/environment.vo';
import { assertCallerCanMutateEnvironment } from '../services/live-environment-guard';

export interface ICreateRefundInput {
  storeId: string;
  paymentId: string;
  requestId?: string;
  amount: number;
  reason?: string;
  callerEnvironment?: Environment;
}

export interface ICreateRefundOutput {
  refund: RefundObject;
  payment: PaymentObject;
}

export class CreateRefundUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: ICreateRefundInput): Promise<ICreateRefundOutput> {
    return this.unitOfWork.execute((repos) => this.executeInTransaction(input, repos));
  }

  async executeInTransaction(
    input: ICreateRefundInput,
    repos: ITransactedRepositories,
  ): Promise<ICreateRefundOutput> {
    const payment = await repos.paymentRepository.findByIdAndStoreIdForUpdate(
      input.paymentId,
      input.storeId,
    );

    if (!payment) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    assertCallerCanMutateEnvironment(
      payment.environment,
      input.callerEnvironment ?? Environment.TEST,
    );

    if (!payment.isConfirmed() && !payment.isReleased()) {
      throw new InvalidRefundAmountError('Can only refund confirmed or released payments');
    }

    const remainingRefundable = payment.amount - payment.totalRefunded;

    if (input.amount <= 0) {
      throw new InvalidRefundAmountError('Refund amount must be positive');
    }

    if (input.amount > remainingRefundable) {
      throw new InvalidRefundAmountError(
        `Refund amount exceeds remaining refundable amount (${remainingRefundable} cents)`,
      );
    }

    // O estorno devolve dinheiro ao ledger de onde ele saiu: quem manda e o
    // ambiente do pagamento, nao o da request.
    const account = await repos.accountRepository.findByStoreIdAndEnvironmentForUpdate(
      input.storeId,
      payment.environment,
    );
    if (!account) {
      throw new AccountNotFoundError(input.storeId);
    }

    const feeRefunded = Math.round(payment.fee * (input.amount / payment.amount));
    const balanceDeduction = input.amount - feeRefunded;

    const refund = Refund.create({
      paymentId: payment.id,
      amount: input.amount,
      feeRefunded,
      reason: input.reason,
    });
    refund.process();

    if (payment.isConfirmed()) {
      account.deductFromPending(balanceDeduction);
    } else {
      account.deductFromAvailable(balanceDeduction);
    }

    payment.addRefund(input.amount);

    await repos.refundRepository.save(refund);
    await repos.accountRepository.update(account);
    await repos.paymentRepository.update(payment);

    const transaction = Transaction.create({
      accountId: account.id,
      type: TransactionType.REFUND_DEDUCTED,
      amount: input.amount,
      fee: feeRefunded,
      netAmount: balanceDeduction,
      balanceAfter: account.totalBalance,
      referenceType: 'REFUND',
      referenceId: refund.id,
      description: `Estorno parcial (#${refund.id.split('-')[0]})`,
    });
    await repos.transactionRepository.save(transaction);

    const outboxEvent = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: payment.id,
      eventType: 'payment.refunded',
      requestId: input.requestId,
      storeId: payment.storeId,
      payload: payment.toObject() as unknown as Record<string, unknown>,
    });
    await repos.outboxWriter.save(outboxEvent);

    return {
      refund: refund.toObject(),
      payment: payment.toObject(),
    };
  }
}
