import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsObject,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '@hockpay/core';

/**
 * DTO for customer data in payment creation.
 * Customer will be created on-the-fly if not exists.
 */
export class PaymentCustomerDto {
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'document must be a valid CPF (11 digits) or CNPJ (14 digits)',
  })
  document: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  complement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, {
    message: 'zipCode must be in format 00000-000 or 00000000',
  })
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;
}

/**
 * DTO for creating a payment.
 */
export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @IsInt()
  @Min(1, { message: 'amount must be at least 1 cent' })
  @Max(9999999999, { message: 'amount cannot exceed 99,999,999.99 BRL' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsObject()
  paymentDetails?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  acquirerId?: string;

  @IsObject()
  customer: PaymentCustomerDto;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
