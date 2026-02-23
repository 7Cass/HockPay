import { IsInt, IsString, IsEnum, IsOptional, IsNotEmpty, IsEmail, Min, ValidateNested, IsObject, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO: CreatePayment
 *
 * Dados para criação de um pagamento
 */
export class CreatePaymentCustomerDTO {
  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNotEmpty()
  @IsString()
  document: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreatePaymentItemDTO {
  @IsOptional()
  @IsString()
  externalId?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsInt()
  @Min(1)
  unitPrice: number;
}

export class CreatePaymentDTO {
  @IsOptional()
  @IsString()
  externalId?: string;

  @IsInt()
  @Min(100) // Mínimo R$ 1,00
  amount: number;

  @IsOptional()
  @IsString()
  @IsEnum(['BRL', 'USD', 'EUR'])
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => CreatePaymentCustomerDTO)
  customer: CreatePaymentCustomerDTO;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentItemDTO)
  items?: CreatePaymentItemDTO[];

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO: PaymentResponse
 *
 * Resposta da criação de um pagamento
 */
export interface PaymentResponseDTO {
  id: string;
  externalId: string | null;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description: string | null;
  status: string;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  checkoutUrl: string | null;
  expiresAt: string;
  createdAt: string;
}
