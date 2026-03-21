import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUrl,
  IsObject,
  MaxLength
} from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsInt()
  @Min(1, { message: 'amount must be at least 1 cent' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  successUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  cancelUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400) // max 1 day
  expiresInSeconds?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
