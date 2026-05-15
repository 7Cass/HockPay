import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentStatus } from '@hockpay/core';

/**
 * Query DTO for listing payments.
 */
export class ListPaymentsQueryDto {
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
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * Response DTO for list payments endpoint.
 */
export class ListPaymentsResponseDto {
  payments: {
    id: string;
    storeId: string;
    customerId?: string;
    externalId?: string;
    paymentLinkId?: string;
    paymentOrigin?: string;
    attemptNumber?: number;
    attemptCount?: number;
    isLatestAttempt?: boolean;
    amount: number;
    fee: number;
    netAmount: number;
    currency: string;
    description?: string;
    payerName?: string;
    payerDocument?: string;
    payerEmail?: string;
    status: PaymentStatus;
    pixChargeId?: string;
    pixCharge?: {
      id: string;
      status: string;
      pixTxId: string;
    };
    checkoutUrl?: string;
    expiresAt: Date;
    paidAt?: Date;
    releasedAt?: Date;
    failedReason?: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
