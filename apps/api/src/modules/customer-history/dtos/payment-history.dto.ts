import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentMethod, PaymentStatus } from '@hockpay/core';

export class ListCustomerHistoryPaymentsQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CustomerHistoryPaymentDto {
  id: string;
  externalId?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description?: string;
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  pixTxId?: string;
  expiresAt: Date;
  paidAt?: Date;
  releasedAt?: Date;
  failedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ListCustomerHistoryPaymentsResponseDto {
  payments: CustomerHistoryPaymentDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class GetCustomerHistoryPaymentResponseDto {
  payment: CustomerHistoryPaymentDto;
}
