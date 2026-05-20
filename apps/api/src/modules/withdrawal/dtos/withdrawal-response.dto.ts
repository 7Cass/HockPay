import {
  TransactionObject,
  WithdrawalObject,
  WithdrawalStatus,
  WithdrawalSummary,
  WithdrawalTimelineEvent,
} from '@hockpay/core';
import { BankAccountResponseDto } from '../../bank-account/dtos/bank-account-response.dto';

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
  bankAccount?: BankAccountResponseDto | null;
  transactions?: TransactionObject[];
  timeline?: WithdrawalTimelineEvent[];
}

export interface ListWithdrawalsResponseDto {
  withdrawals: WithdrawalResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: WithdrawalSummary;
}
