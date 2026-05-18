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

export interface ICompleteWithdrawalInput {
  withdrawalId: string;
  storeId?: string;
  requestId?: string;
  pixE2eId?: string;
  paidAt?: Date;
}

export interface ICompleteWithdrawalOutput {
  withdrawal: WithdrawalObject;
  account: AccountObject;
}

export class CompleteWithdrawalUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(
    input: ICompleteWithdrawalInput,
  ): Promise<ICompleteWithdrawalOutput> {
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

      withdrawal.complete({
        pixE2eId: input.pixE2eId,
        paidAt: input.paidAt,
      });
      account.deductFromBlocked(withdrawal.amount);

      await repos.withdrawalRepository.update(withdrawal);
      await repos.accountRepository.update(account);
      await repos.transactionRepository.save(
        Transaction.create({
          accountId: account.id,
          type: TransactionType.WITHDRAWAL_SENT,
          amount: withdrawal.amount,
          fee: withdrawal.fee,
          netAmount: withdrawal.netAmount,
          balanceAfter: account.available,
          referenceType: "WITHDRAWAL",
          referenceId: withdrawal.id,
          description: `Withdrawal sent ${withdrawal.id}`,
        }),
      );
      await repos.outboxWriter.save(
        OutboxEvent.create({
          aggregateType: "Withdrawal",
          aggregateId: withdrawal.id,
          eventType: "withdrawal.completed",
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
