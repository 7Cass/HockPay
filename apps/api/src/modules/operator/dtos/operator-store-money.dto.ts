import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Environment } from '@hockpay/core';

/**
 * The desk withdrawing on behalf of a store.
 *
 * `environment` is required and has no TEST default, for the reason the read
 * routes established: a merchant resolves an environment from its session, an
 * operator does not operate one store -- it moves money for many, in both
 * ledgers, and a silent default is how the right amount leaves the wrong one.
 *
 * The amount bounds mirror the merchant's own `CreateWithdrawalDto`. The desk
 * withdrawing by ticket is still a withdrawal, and a limit that only applies
 * when the merchant is the one asking is not a limit.
 *
 * `reason` is shape-checked here and checked again for presence in the use
 * case: a direct HTTP client does not go through this DTO's screen.
 */
export class OperatorCreateWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  bankAccountId!: string;

  @IsInt()
  @Min(1000)
  @Max(500000)
  amount!: number;

  @IsEnum(Environment)
  environment!: Environment;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

/**
 * The desk refunding on behalf of a store.
 *
 * `environment` here is a confirmation rather than an instruction: the payment
 * already knows its ledger, and the use case refuses the request when the two
 * disagree instead of following the caller into the wrong one.
 */
export class OperatorCreateRefundDto {
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @IsInt()
  @Min(1, { message: 'amount must be at least 1 cent' })
  amount!: number;

  @IsEnum(Environment)
  environment!: Environment;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
