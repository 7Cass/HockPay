import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
} from 'class-validator';
import { StoreLiveStatus } from '@hockpay/core';

/**
 * The desk's decision on a store's LIVE enablement.
 *
 * `reason` is validated here for shape, and again in the use case for
 * presence: a direct HTTP client does not go through this DTO's screen, and
 * the audit rule belongs to the domain, not to a class-validator decorator.
 */
export class DecideLiveEnablementDto {
  @IsEnum(['approve', 'reject', 'suspend'])
  decision!: 'approve' | 'reject' | 'suspend';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class OperatorStoreDto {
  id!: string;
  merchantId!: string;
  name!: string;
  slug!: string;
  liveStatus!: StoreLiveStatus;
  liveStatusReason?: string;
  liveStatusChangedAt?: Date;
  createdAt!: Date;
}

/**
 * The desk's commercial condition for a store.
 *
 * The three fields are required together: there is no partial update, because
 * a before/after that only carries the changed field makes whoever reads the
 * trail reconstruct the rest from older lines.
 *
 * Shape is validated here; the accepted range lives in the `Store` entity, so
 * a direct HTTP client cannot reach an out-of-range value by skipping this DTO.
 */
export class UpdateCommercialTermsDto {
  @IsNumber()
  feePercent!: number;

  @IsInt()
  feeFixed!: number;

  @IsInt()
  settlementDays!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
