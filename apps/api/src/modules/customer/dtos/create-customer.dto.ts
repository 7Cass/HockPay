import {
  IsString,
  IsOptional,
  IsEmail,
  Matches,
  MaxLength,
  IsObject,
} from 'class-validator';

/**
 * DTO for creating a customer.
 */
export class CreateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'document must be a valid CPF (11 digits) or CNPJ (14 digits)',
  })
  document: string;

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

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * Response DTO for creating a customer.
 */
export class CustomerResponseDto {
  id: string;
  storeId: string;
  externalId?: string;
  name?: string;
  email?: string;
  document: string;
  formattedDocument: string;
  documentType: 'CPF' | 'CNPJ';
  phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response DTO for create customer endpoint.
 */
export class CreateCustomerResponseDto {
  customer: CustomerResponseDto;
  created: boolean;
}
