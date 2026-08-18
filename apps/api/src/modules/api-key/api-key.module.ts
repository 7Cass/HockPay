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
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from 'src/infra/database/prisma.service';

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
 * Use cases from the core layer are instantiated here with their dependencies.
 */
@Module({
  imports: [AuthModule],
  controllers: [ApiKeyController],
  providers: [
    // Guards
    ApiKeyGuard,

    {
      provide: ApiKeyRepository,
      useFactory: (prisma: PrismaService) => new ApiKeyRepository(prisma),
      inject: [PrismaService],
    },
    TokenGeneratorService,

    // Use Cases (from core) - CreateApiKeyUseCase
    {
      provide: CreateApiKeyUseCase,
      useFactory: (
        repo: ApiKeyRepository,
        tokenGenerator: TokenGeneratorService,
      ) => {
        return new CreateApiKeyUseCase(repo, tokenGenerator);
      },
      inject: [ApiKeyRepository, TokenGeneratorService],
    },

    // ListApiKeysUseCase
    {
      provide: ListApiKeysUseCase,
      useFactory: (repo: ApiKeyRepository) => {
        return new ListApiKeysUseCase(repo);
      },
      inject: [ApiKeyRepository],
    },

    // RevokeApiKeyUseCase
    {
      provide: RevokeApiKeyUseCase,
      useFactory: (repo: ApiKeyRepository) => {
        return new RevokeApiKeyUseCase(repo);
      },
      inject: [ApiKeyRepository],
    },

    // ValidateApiKeyUseCase
    {
      provide: ValidateApiKeyUseCase,
      useFactory: (
        repo: ApiKeyRepository,
        tokenGenerator: TokenGeneratorService,
      ) => {
        return new ValidateApiKeyUseCase(repo, tokenGenerator);
      },
      inject: [ApiKeyRepository, TokenGeneratorService],
    },
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
