import { WithdrawalObject, WithdrawalStatus } from '@hockpay/core';

export class WithdrawalResponseDto {
  id: string;
  accountId: string;
  bankAccountId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: WithdrawalStatus;
  pixE2eId?: string;
  paidAt?: Date;
  failedReason?: string;
  processingAttempts: number;
  nextProcessAt?: Date;
  lastProcessingError?: string;
  createdAt: Date;
  updatedAt: Date;

  static fromObject(withdrawal: WithdrawalObject): WithdrawalResponseDto {
    return { ...withdrawal };
  }
}

export interface CreateWithdrawalResponseDto {
  withdrawal: WithdrawalResponseDto;
}

export interface GetWithdrawalResponseDto {
  withdrawal: WithdrawalResponseDto;
}

export interface ListWithdrawalsResponseDto {
  withdrawals: WithdrawalResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
