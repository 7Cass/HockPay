import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ReceiptStatus } from '@hockpay/core';

export class ListCustomerHistoryReceiptsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  receiptNumber?: string;
}

export class CustomerHistoryReceiptDto {
  id: string;
  receiptNumber: string;
  paymentId: string;
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
  payeeName: string;
  payeeDocument?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description?: string;
  status: ReceiptStatus;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ListCustomerHistoryReceiptsResponseDto {
  receipts: CustomerHistoryReceiptDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class GetCustomerHistoryReceiptResponseDto {
  receipt: CustomerHistoryReceiptDto;
}
