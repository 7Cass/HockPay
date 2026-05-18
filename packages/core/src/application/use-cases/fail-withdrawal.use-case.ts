import { AccountObject } from "../../domain/entities/account.entity";
import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import {
  Transaction,
  TransactionType,
} from "../../domain/entities/transaction.entity";
import { WithdrawalObject } from "../../domain/entities/withdrawal.entity";
import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";
import { InvalidWithdrawalStatusError } from "../../domain/errors/invalid-withdrawal-status.error";
import { WithdrawalNotFoundError } from "../../domain/errors/withdrawal-not-found.error";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";
import { sanitizeWithdrawal } from "./create-withdrawal.use-case";

export interface IFailWithdrawalInput {
  withdrawalId: string;
  storeId?: string;
  requestId?: string;
  reason: string;
}

export interface IFailWithdrawalOutput {
  withdrawal: WithdrawalObject;
  account: AccountObject;
}

export class FailWithdrawalUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IFailWithdrawalInput): Promise<IFailWithdrawalOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const withdrawal = await repos.withdrawalRepository.findById(
        input.withdrawalId,
      );
      if (!withdrawal) throw new WithdrawalNotFoundError(input.withdrawalId);

      const account = await repos.accountRepository.findById(
        withdrawal.accountId,
      );
      if (!account) throw new AccountNotFoundError(withdrawal.accountId);
      if (input.storeId && account.storeId !== input.storeId) {
        throw new WithdrawalNotFoundError(input.withdrawalId);
      }

      if (withdrawal.isTerminal()) {
        throw new InvalidWithdrawalStatusError(
          `Withdrawal ${withdrawal.id} is already terminal`,
        );
      }

      withdrawal.fail(input.reason);
      account.unblock(withdrawal.amount);

      await repos.withdrawalRepository.update(withdrawal);
      await repos.accountRepository.update(account);
      await repos.transactionRepository.save(
        Transaction.create({
          accountId: account.id,
          type: TransactionType.WITHDRAWAL_REVERSED,
          amount: withdrawal.amount,
          fee: 0,
          netAmount: withdrawal.amount,
          balanceAfter: account.available,
          referenceType: "WITHDRAWAL",
          referenceId: withdrawal.id,
          description: `Withdrawal reversed ${withdrawal.id}`,
        }),
      );
      await repos.outboxWriter.save(
        OutboxEvent.create({
          aggregateType: "Withdrawal",
          aggregateId: withdrawal.id,
          eventType: "withdrawal.failed",
          requestId: input.requestId,
          storeId: account.storeId,
          payload: sanitizeWithdrawal(account.storeId, withdrawal.toObject()),
        }),
      );

      return {
        withdrawal: withdrawal.toObject(),
        account: account.toObject(),
      };
    });
  }
}
