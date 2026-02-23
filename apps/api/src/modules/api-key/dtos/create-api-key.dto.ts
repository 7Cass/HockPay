import { IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Environment } from '@hockpay/core';

/**
 * DTO for creating a new API Key.
 *
 * This is used when a merchant wants to create a new API key
 * for their store via the dashboard.
 */
export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  name!: string;

  @IsEnum(Environment, {
    message: 'Environment must be either TEST or LIVE',
  })
  environment!: Environment;
}

/**
 * DTO for API Key response (without the plain key).
 *
 * This is used when listing API keys or after creation.
 * The plain key is NEVER included in this response.
 */
export class ApiKeyResponseDto {
  id!: string;
  storeId!: string;
  prefix!: string;
  name!: string;
  environment!: Environment;
  lastUsedAt?: Date;
  createdAt!: Date;
  revokedAt?: Date;
}

/**
 * DTO for API Key creation response (WITH the plain key).
 *
 * This is ONLY used immediately after creation.
 * The plain key is shown only once and must be saved by the merchant.
 */
export class CreatedApiKeyResponseDto extends ApiKeyResponseDto {
  /**
   * The plain API Key.
   *
   * IMPORTANT: This is the ONLY time this value is returned.
   * The merchant must save it securely, as it cannot be retrieved again.
   */
  plainKey!: string;
}

/**
 * DTO for listing API Keys.
 */
export class ListApiKeysResponseDto {
  apiKeys!: ApiKeyResponseDto[];
}

/**
 * DTO for revoking an API Key.
 */
export class RevokeApiKeyResponseDto {
  message!: string;
  apiKey!: ApiKeyResponseDto;
}
