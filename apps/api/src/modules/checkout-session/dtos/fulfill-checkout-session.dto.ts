import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class FulfillCheckoutCustomerDto {
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
  @IsString()
  @MaxLength(255)
  email?: string;
}

export class FulfillCheckoutSessionDto {
  @IsObject()
  @ValidateNested()
  @Type(() => FulfillCheckoutCustomerDto)
  customer: FulfillCheckoutCustomerDto;
}
