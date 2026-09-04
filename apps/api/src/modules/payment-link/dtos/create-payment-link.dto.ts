import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateChargeLineItemDto } from '../../../common/dtos/line-item.dto';

export class CreatePaymentLinkDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'amount must be at least 1 cent' })
  @Max(9999999999, { message: 'amount cannot exceed 99,999,999.99 BRL' })
  amount?: number;

  /**
   * Itens do catalogo cobrados por este link. Mutuamente exclusivo com
   * `amount` -- a regra de exatamente um dos dois vive no
   * LineItemResolverService, igual a checkout sessions. Preco, nome e imagem
   * viram snapshot na criacao e nao acompanham edicoes posteriores do produto.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChargeLineItemDto)
  items?: CreateChargeLineItemDto[];

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
