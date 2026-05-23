import { TransactionObject } from '@hockpay/core';

export interface TransactionResponseDto {
  transaction: TransactionObject;
}

export interface ListTransactionsResponseDto {
  data: TransactionObject[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
