import {
  IsDateString,
  IsEmpty,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePaymentLinkDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'amount must be at least 1 cent' })
  @Max(9999999999, { message: 'amount cannot exceed 99,999,999.99 BRL' })
  amount?: number;

  @IsOptional()
  @IsEmpty({
    message: 'items are not supported for payment links; provide amount',
  })
  items?: never;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  internalReference?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
