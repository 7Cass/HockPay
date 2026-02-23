import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query DTO for listing customers.
 */
export class ListCustomersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Response DTO for listing customers.
 */
export class ListCustomersResponseDto {
  customers: {
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
  }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
