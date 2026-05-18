import {
  WithdrawalObject,
  WithdrawalStatus,
} from "../../domain/entities/withdrawal.entity";
import { AccountNotFoundError } from "../../domain/errors/account-not-found.error";
import { IAccountRepository } from "../../domain/repositories/account.repository.interface";
import {
  IWithdrawalRepository,
  ListWithdrawalsOptions,
} from "../../domain/repositories/withdrawal.repository.interface";

export interface IListWithdrawalsInput {
  storeId: string;
  page?: number;
  limit?: number;
  status?: WithdrawalStatus;
  bankAccountId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface IListWithdrawalsOutput {
  withdrawals: WithdrawalObject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListWithdrawalsUseCase {
  constructor(
    private readonly withdrawalRepository: IWithdrawalRepository,
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(input: IListWithdrawalsInput): Promise<IListWithdrawalsOutput> {
    const account = await this.accountRepository.findByStoreId(input.storeId);
    if (!account) throw new AccountNotFoundError(input.storeId);

    const options: ListWithdrawalsOptions = {
      accountId: account.id,
      page: input.page ?? 1,
      limit: Math.min(input.limit ?? 20, 100),
      status: input.status,
      bankAccountId: input.bankAccountId,
      startDate: input.startDate,
      endDate: input.endDate,
    };

    const result = await this.withdrawalRepository.list(options);

    return {
      withdrawals: result.withdrawals.map((withdrawal) =>
        withdrawal.toObject(),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
