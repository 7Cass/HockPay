import { WithdrawalObject } from "../../domain/entities/withdrawal.entity";
import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";
import { WithdrawalNotFoundError } from "../../domain/errors/withdrawal-not-found.error";
import { IUnitOfWork } from "../../domain/repositories/unit-of-work.interface";

export interface IGetWithdrawalInput {
  storeId: string;
  withdrawalId: string;
}

export interface IGetWithdrawalOutput {
  withdrawal: WithdrawalObject;
}

export class GetWithdrawalUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IGetWithdrawalInput): Promise<IGetWithdrawalOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const account = await repos.accountRepository.findByStoreId(
        input.storeId,
      );
      if (!account) throw new AccountNotFoundError(input.storeId);

      const withdrawal = await repos.withdrawalRepository.findByIdAndAccountId(
        input.withdrawalId,
        account.id,
      );
      if (!withdrawal) throw new WithdrawalNotFoundError(input.withdrawalId);

      return { withdrawal: withdrawal.toObject() };
    });
  }
}
