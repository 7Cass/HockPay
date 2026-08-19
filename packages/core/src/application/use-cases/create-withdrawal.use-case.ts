import { AccountObject } from "../../domain/entities/account.entity";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import {
  Transaction,
  TransactionType,
} from "../../domain/entities/transaction.entity";
import {
  Withdrawal,
  WithdrawalObject,
} from "../../domain/entities/withdrawal.entity";
import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";
import { BankAccountNotFoundError } from "../../domain/errors/bank-account-not-found.error";
import { BankAccountNotVerifiedError } from "../../domain/errors/bank-account-not-verified.error";
import { InsufficientWithdrawalBalanceError } from "../../domain/errors/insufficient-withdrawal-balance.error";
import { StoreInactiveError } from "../../domain/errors/store-inactive.error";
import { StoreNotApprovedError } from "../../domain/errors/store-not-approved.error";
import { StoreNotFoundError } from "../../domain/errors/store-not-found.error";
import {
  ITransactedRepositories,
  IUnitOfWork,
} from "../../domain/repositories/unit-of-work.interface";
import { WithdrawalPolicy } from "../services/withdrawal-policy.service";
import { Environment } from "../../domain/value-objects/environment.vo";

export interface ICreateWithdrawalInput {
  storeId: string;
  bankAccountId: string;
  amount: number;
  requestId?: string;
  environment?: Environment;
}

export interface ICreateWithdrawalOutput {
  withdrawal: WithdrawalObject;
  account: AccountObject;
}

export class CreateWithdrawalUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly policy: WithdrawalPolicy = new WithdrawalPolicy(),
  ) {}

  async execute(
    input: ICreateWithdrawalInput,
  ): Promise<ICreateWithdrawalOutput> {
    return this.unitOfWork.execute((repos) =>
      this.executeInTransaction(input, repos),
    );
  }

  async executeInTransaction(
    input: ICreateWithdrawalInput,
    repos: ITransactedRepositories,
  ): Promise<ICreateWithdrawalOutput> {
    const store = await repos.storeRepository.findById(input.storeId);
    if (!store) throw new StoreNotFoundError(input.storeId);
    if (!store.isActive) throw new StoreInactiveError(store.id);
    if (!store.isApproved) throw new StoreNotApprovedError(store.id);

    const account = await repos.accountRepository.findByStoreIdForUpdate(
      input.storeId,
    );
    if (!account) throw new AccountNotFoundError(input.storeId);

    const bankAccount = await repos.bankAccountRepository.findById(
      input.bankAccountId,
    );
    if (!bankAccount || bankAccount.storeId !== input.storeId) {
      throw new BankAccountNotFoundError(input.bankAccountId);
    }
    if (!bankAccount.isVerified) {
      throw new BankAccountNotVerifiedError(bankAccount.id);
    }

    const { startOfDay, endOfDay } = getDayRange(new Date());
    const dailyAmount =
      await repos.withdrawalRepository.sumAmountCreatedInRange(
        account.id,
        startOfDay,
        endOfDay,
      );
    const dailyCount = await repos.withdrawalRepository.countCreatedInRange(
      account.id,
      startOfDay,
      endOfDay,
    );
    this.policy.validate({
      amountInCents: input.amount,
      dailyAmountAlreadyRequested: dailyAmount,
      dailyCountAlreadyRequested: dailyCount,
    });
    const feeResult = this.policy.calculate(input.amount);

    if (input.amount > account.available) {
      throw new InsufficientWithdrawalBalanceError();
    }

    const withdrawal = Withdrawal.create({
      accountId: account.id,
      bankAccountId: bankAccount.id,
      amount: input.amount,
      fee: feeResult.feeInCents,
      environment: input.environment ?? Environment.TEST,
    });

    account.block(withdrawal.amount);

    await repos.withdrawalRepository.save(withdrawal);
    await repos.accountRepository.update(account);

    const transaction = Transaction.create({
      accountId: account.id,
      type: TransactionType.WITHDRAWAL_RESERVED,
      amount: withdrawal.amount,
      fee: withdrawal.fee,
      netAmount: withdrawal.netAmount,
      balanceAfter: account.available,
      referenceType: "WITHDRAWAL",
      referenceId: withdrawal.id,
      description: `Withdrawal reserved ${withdrawal.id}`,
    });
    await repos.transactionRepository.save(transaction);

    const outboxEvent = OutboxEvent.create({
      aggregateType: "Withdrawal",
      aggregateId: withdrawal.id,
      eventType: "withdrawal.created",
      requestId: input.requestId,
      storeId: input.storeId,
      payload: sanitizeWithdrawal(input.storeId, withdrawal.toObject()),
    });
    await repos.outboxWriter.save(outboxEvent);

    return {
      withdrawal: withdrawal.toObject(),
      account: account.toObject(),
    };
  }
}

function getDayRange(now: Date): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

export function sanitizeWithdrawal(
  storeId: string,
  withdrawal: WithdrawalObject,
): Record<string, unknown> {
  return {
    ...withdrawal,
    storeId,
  };
}
