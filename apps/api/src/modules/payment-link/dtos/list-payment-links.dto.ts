import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { PaymentLinkStatus } from '@hockpay/core';

export class ListPaymentLinksDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['ACTIVE', 'OPENED', 'PAID', 'EXPIRED', 'CANCELLED'])
  status?: PaymentLinkStatus;
}
