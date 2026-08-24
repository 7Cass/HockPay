import { Module } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import {
  CreateApiKeyUseCase,
  ListApiKeysUseCase,
  RevokeApiKeyUseCase,
  ValidateApiKeyUseCase,
} from '@hockpay/core';
import { ApiKeyRepository } from '@hockpay/infrastructure';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { provideUseCase } from 'src/common/provide-use-case';
import { AuthModule } from '../auth/auth.module';

/**
 * ApiKey Module
 *
 * This module provides API key management functionality.
 *
 * Features:
 * - Create new API keys (via JWT-authenticated dashboard)
 * - List API keys for a store
 * - Revoke API keys
 * - Validate API keys (via ApiKeyGuard for public API authentication)
 *
 * ApiKeyRepository e TokenGeneratorService vem do InfrastructureModule global.
 */
@Module({
  imports: [AuthModule],
  controllers: [ApiKeyController],
  providers: [
    ApiKeyGuard,

    provideUseCase(CreateApiKeyUseCase, [
      ApiKeyRepository,
      TokenGeneratorService,
    ]),
    provideUseCase(ListApiKeysUseCase, [ApiKeyRepository]),
    provideUseCase(RevokeApiKeyUseCase, [ApiKeyRepository]),
    provideUseCase(ValidateApiKeyUseCase, [
      ApiKeyRepository,
      TokenGeneratorService,
    ]),
  ],
  exports: [
    ApiKeyGuard,
    CreateApiKeyUseCase,
    ListApiKeysUseCase,
    RevokeApiKeyUseCase,
    ValidateApiKeyUseCase,
  ],
})
export class ApiKeyModule {}
