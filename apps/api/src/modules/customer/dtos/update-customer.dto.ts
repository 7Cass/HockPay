import {
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  Matches,
} from 'class-validator';
import { CustomerResponseDto } from './customer-response.dto';

/**
 * DTO for updating a customer.
 */
export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
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
 * Response DTO for update customer endpoint.
 */
export class UpdateCustomerResponseDto {
  customer: CustomerResponseDto;
}
