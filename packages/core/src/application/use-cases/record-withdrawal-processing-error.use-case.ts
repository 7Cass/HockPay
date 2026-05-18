import { WithdrawalObject } from "../../domain/entities/withdrawal.entity";
import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";
import { InvalidWithdrawalStatusError } from "../../domain/errors/invalid-withdrawal-status.error";
import { WithdrawalNotFoundError } from "../../domain/errors/withdrawal-not-found.error";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";

export interface IRecordWithdrawalProcessingErrorInput {
  withdrawalId: string;
  error: string;
  nextProcessAt: Date;
}

export interface IRecordWithdrawalProcessingErrorOutput {
  withdrawal: WithdrawalObject;
}

export class RecordWithdrawalProcessingErrorUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(
    input: IRecordWithdrawalProcessingErrorInput,
  ): Promise<IRecordWithdrawalProcessingErrorOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const withdrawal = await repos.withdrawalRepository.findById(
        input.withdrawalId,
      );
      if (!withdrawal) throw new WithdrawalNotFoundError(input.withdrawalId);

      const account = await repos.accountRepository.findById(
        withdrawal.accountId,
      );
      if (!account) throw new AccountNotFoundError(withdrawal.accountId);

      if (!withdrawal.isProcessing()) {
        throw new InvalidWithdrawalStatusError(
          `Withdrawal ${withdrawal.id} must be PROCESSING to record retry`,
        );
      }

      withdrawal.recordRetry(input.error, input.nextProcessAt);
      await repos.withdrawalRepository.update(withdrawal);

      return {
        withdrawal: withdrawal.toObject(),
      };
    });
  }
}
