import { Withdrawal, WithdrawalStatus } from "../entities/withdrawal.entity";

export interface ListWithdrawalsOptions {
  accountId: string;
  page?: number;
  limit?: number;
  status?: WithdrawalStatus;
  bankAccountId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ListWithdrawalsResult {
  withdrawals: Withdrawal[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IWithdrawalRepository {
  save(withdrawal: Withdrawal): Promise<void>;
  update(withdrawal: Withdrawal): Promise<void>;
  findById(id: string): Promise<Withdrawal | null>;
  findByIdAndAccountId(
    id: string,
    accountId: string,
  ): Promise<Withdrawal | null>;
  list(options: ListWithdrawalsOptions): Promise<ListWithdrawalsResult>;
  countCreatedInRange(
    accountId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number>;
  sumAmountCreatedInRange(
    accountId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number>;
  /**
   * Finds withdrawals ready for processing.
   * Implementations may also include stale PROCESSING rows for crash recovery.
   */
  findProcessablePending(limit: number, now?: Date): Promise<Withdrawal[]>;
}
