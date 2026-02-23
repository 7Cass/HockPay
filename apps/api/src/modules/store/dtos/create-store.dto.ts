import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * DTO for creating a new store.
 */
export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, {
    message:
      'Slug must contain only lowercase letters, numbers, and hyphens. It must start and end with alphanumeric characters.',
  })
  @MinLength(3)
  @MaxLength(50)
  slug?: string;
}

/**
 * Response DTO for store creation.
 */
export class CreateStoreResponseDto {
  store!: {
    id: string;
    merchantId: string;
    name: string;
    slug: string;
    isActive: boolean;
    isApproved: boolean;
    settlementDays: number;
    feePercent: number;
    feeFixed: number;
    createdAt: Date;
    updatedAt: Date;
  };

  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
}
