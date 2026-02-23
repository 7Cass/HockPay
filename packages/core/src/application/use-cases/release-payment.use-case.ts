import { Payment, PaymentObject } from '../../domain/entities/payment.entity';
import { Account, AccountObject } from '../../domain/entities/account.entity';
import { Transaction, TransactionType } from '../../domain/entities/transaction.entity';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { IAccountRepository } from '../../domain/repositories/account.repository.interface';
import { ITransactionRepository } from '../../domain/repositories/transaction.repository.interface';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';
import { PaymentNotConfirmedError } from '../../domain/errors/payment-not-confirmed.error';

/**
 * Input DTO for ReleasePaymentUseCase.
 */
export interface IReleasePaymentInput {
  paymentId: string;
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
 */
export class ReleasePaymentUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly accountRepository: IAccountRepository,
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(input: IReleasePaymentInput): Promise<IReleasePaymentOutput> {
    // Find payment
    const payment = await this.paymentRepository.findById(input.paymentId);

    if (!payment) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    // Check if already released (idempotent)
    if (payment.isTerminal() && payment.status !== 'CONFIRMED') {
      if (payment.releasedAt) {
        const account = await this.accountRepository.findByStoreId(payment.storeId);
        return {
          payment: payment.toObject(),
          account: account?.toObject() as AccountObject,
          alreadyReleased: true,
        };
      }
    }

    // Validate payment is confirmed
    if (!payment.isConfirmed()) {
      throw new PaymentNotConfirmedError(input.paymentId, payment.status);
    }

    // Find account
    const account = await this.accountRepository.findByStoreId(payment.storeId);

    if (!account) {
      throw new AccountNotFoundError(payment.storeId);
    }

    // Release the payment
    payment.release();
    await this.paymentRepository.update(payment);

    // Move funds from pending to available
    account.releaseFromPending(payment.netAmount);
    await this.accountRepository.update(account);

    // Create transaction record
    const balanceAfter = account.available;
    const transaction = Transaction.create({
      accountId: account.id,
      type: TransactionType.PAYMENT_RELEASED,
      amount: payment.amount,
      fee: payment.fee,
      netAmount: payment.netAmount,
      balanceAfter,
      referenceType: 'Payment',
      referenceId: payment.id,
      description: `Release of payment ${payment.id}`,
    });
    await this.transactionRepository.save(transaction);

    return {
      payment: payment.toObject(),
      account: account.toObject(),
      alreadyReleased: false,
    };
  }
}
