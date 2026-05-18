import { OutboxEvent } from "../../domain/entities/outbox-event.entity";
import { WithdrawalObject } from "../../domain/entities/withdrawal.entity";
import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";
import { InvalidWithdrawalStatusError } from "../../domain/errors/invalid-withdrawal-status.error";
import { WithdrawalNotFoundError } from "../../domain/errors/withdrawal-not-found.error";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";
import { sanitizeWithdrawal } from "./create-withdrawal.use-case";

export interface IMarkWithdrawalProcessingInput {
  withdrawalId: string;
  storeId?: string;
  requestId?: string;
}

export interface IMarkWithdrawalProcessingOutput {
  withdrawal: WithdrawalObject;
  alreadyProcessing: boolean;
}

export class MarkWithdrawalProcessingUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(
    input: IMarkWithdrawalProcessingInput,
  ): Promise<IMarkWithdrawalProcessingOutput> {
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

      if (withdrawal.isProcessing()) {
        return {
          withdrawal: withdrawal.toObject(),
          alreadyProcessing: true,
        };
      }

      if (!withdrawal.isPending()) {
        throw new InvalidWithdrawalStatusError(
          `Withdrawal ${withdrawal.id} cannot move from ${withdrawal.status} to PROCESSING`,
        );
      }

      withdrawal.markProcessing();
      await repos.withdrawalRepository.update(withdrawal);
      await repos.outboxWriter.save(
        OutboxEvent.create({
          aggregateType: "Withdrawal",
          aggregateId: withdrawal.id,
          eventType: "withdrawal.processing",
          requestId: input.requestId,
          storeId: account.storeId,
          payload: sanitizeWithdrawal(account.storeId, withdrawal.toObject()),
        }),
      );

      return {
        withdrawal: withdrawal.toObject(),
        alreadyProcessing: false,
      };
    });
  }
}
