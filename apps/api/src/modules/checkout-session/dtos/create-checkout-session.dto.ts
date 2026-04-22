import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUrl,
  IsObject,
  MaxLength,
  IsEnum,
  ValidateNested,
  Matches,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerCollectionMode } from '@hockpay/core';

export class CheckoutSessionPrefillCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'document must be a valid CPF (11 digits) or CNPJ (14 digits)',
  })
  document?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class CreateCheckoutSessionDto {
  @IsInt()
  @Min(1, { message: 'amount must be at least 1 cent' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(CustomerCollectionMode)
  customerCollectionMode?: CustomerCollectionMode;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CheckoutSessionPrefillCustomerDto)
  prefillCustomer?: CheckoutSessionPrefillCustomerDto;

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
