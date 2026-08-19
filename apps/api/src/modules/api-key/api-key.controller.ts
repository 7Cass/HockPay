import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  CreateApiKeyUseCase,
  ListApiKeysUseCase,
  RevokeApiKeyUseCase,
  type ICreateApiKeyInput,
  type IListApiKeysInput,
} from '@hockpay/core';
import {
  CreateApiKeyDto,
  CreatedApiKeyResponseDto,
  ListApiKeysResponseDto,
  RevokeApiKeyResponseDto,
} from './dtos/create-api-key.dto';
import { CurrentStore } from '../auth/decorators/current-store.decorator';

/**
 * Controller for API Key management.
 *
 * Endpoints:
 * - POST /api-keys - Create a new API key (requires JWT auth)
 * - GET /api-keys - List all API keys for the store (requires JWT auth)
 * - POST /api-keys/:id/revoke - Revoke an API key (requires JWT auth)
 *
 * All endpoints require JWT authentication (dashboard authentication).
 * The API keys created here are used for public API authentication.
 */
@Controller('api-keys')
export class ApiKeyController {
  constructor(
    private readonly createApiKeyUseCase: CreateApiKeyUseCase,
    private readonly listApiKeysUseCase: ListApiKeysUseCase,
    private readonly revokeApiKeyUseCase: RevokeApiKeyUseCase,
  ) {}

  /**
   * Create a new API Key.
   *
   * This endpoint creates a new API key for the merchant's store.
   * The plain key is returned only once, so the merchant must save it securely.
   *
   * @param request - The HTTP request (contains the store from JWT)
   * @param dto - The creation DTO
   * @returns The created API key with the plain key (shown only once)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentStore() storeId: string,
    @Body() dto: CreateApiKeyDto,
  ): Promise<CreatedApiKeyResponseDto> {
    const input: ICreateApiKeyInput = {
      storeId,
      name: dto.name,
      environment: dto.environment,
    };

    const result = await this.createApiKeyUseCase.execute(input);

    // Return the response with the plain key (shown only once)
    return {
      ...result.apiKey,
      plainKey: result.plainKey,
    };
  }

  /**
   * List all API Keys for the store.
   *
   * This endpoint returns all API keys for the merchant's store.
   * The plain keys are NEVER included in the response.
   *
   * @param request - The HTTP request (contains the store from JWT)
   * @returns List of API keys
   */
  @Get()
  async list(@CurrentStore() storeId: string): Promise<ListApiKeysResponseDto> {
    // List the API keys
    const input: IListApiKeysInput = {
      storeId,
      includeRevoked: false,
    };

    const result = await this.listApiKeysUseCase.execute(input);

    return {
      apiKeys: result.apiKeys,
    };
  }

  /**
   * Revoke an API Key.
   *
   * This endpoint revokes an API key, making it unusable for authentication.
   * The operation is idempotent - revoking an already revoked key succeeds.
   *
   * @param request - The HTTP request (contains the store from JWT)
   * @param id - The API key ID to revoke
   * @returns The revoked API key
   */
  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @CurrentStore() storeId: string,
    @Param('id') id: string,
  ): Promise<RevokeApiKeyResponseDto> {
    const result = await this.revokeApiKeyUseCase.execute({
      storeId,
      apiKeyId: id,
    });

    return {
      message: 'API key revoked successfully',
      apiKey: result.apiKey,
    };
  }
}
