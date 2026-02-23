import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import {
  CreateWebhookConfigUseCase,
  ListWebhookConfigsUseCase,
  GetWebhookConfigUseCase,
  UpdateWebhookConfigUseCase,
  DeleteWebhookConfigUseCase,
  TestWebhookConfigUseCase,
  ListWebhookLogsUseCase,
  RetryWebhookLogUseCase,
  IWebhookConfigRepository,
  IWebhookLogRepository,
} from '@hockpay/core';
import {
  WebhookConfigRepository,
  WebhookLogRepository,
} from '@hockpay/infrastructure';
import { EncryptionService } from '../../infra/services/encryption.service';
import { HmacSignerService } from '../../infra/services/hmac-signer.service';
import { WebhookHttpClientService } from '../../infra/services/webhook-http-client.service';
import { TokenGeneratorService } from '../../infra/services/token-generator.service';
import { JwtService } from '../../infra/services/jwt.service';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';

/**
 * Webhook Module
 *
 * This module provides webhook-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 *
 * Dependencies:
 * - ApiKeyModule: Provides ValidateApiKeyUseCase for CombinedAuthGuard
 */
@Module({
  imports: [
    AuthModule,
    ApiKeyModule, // Provides ValidateApiKeyUseCase
  ],
  controllers: [WebhookController],
  providers: [
    // Infrastructure
    PrismaService,
    JwtService,
    EncryptionService,
    HmacSignerService,
    WebhookHttpClientService,
    TokenGeneratorService,

    // CombinedAuthGuard (uses ValidateApiKeyUseCase from ApiKeyModule, JwtService)
    CombinedAuthGuard,

    // Factory providers for shared repositories (from @hockpay/infrastructure)
    {
      provide: 'IWebhookConfigRepository',
      useFactory: (prisma: PrismaService) => new WebhookConfigRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IWebhookLogRepository',
      useFactory: (prisma: PrismaService) => new WebhookLogRepository(prisma),
      inject: [PrismaService],
    },

    // Use Cases (from core) - injecting interfaces via token
    {
      provide: CreateWebhookConfigUseCase,
      useFactory: (
        webhookConfigRepo: IWebhookConfigRepository,
        tokenGenerator: TokenGeneratorService,
        encryption: EncryptionService,
      ) => {
        return new CreateWebhookConfigUseCase(
          webhookConfigRepo,
          tokenGenerator,
          encryption,
        );
      },
      inject: ['IWebhookConfigRepository', TokenGeneratorService, EncryptionService],
    },

    {
      provide: ListWebhookConfigsUseCase,
      useFactory: (webhookConfigRepo: IWebhookConfigRepository) => {
        return new ListWebhookConfigsUseCase(webhookConfigRepo);
      },
      inject: ['IWebhookConfigRepository'],
    },

    {
      provide: GetWebhookConfigUseCase,
      useFactory: (webhookConfigRepo: IWebhookConfigRepository) => {
        return new GetWebhookConfigUseCase(webhookConfigRepo);
      },
      inject: ['IWebhookConfigRepository'],
    },

    {
      provide: UpdateWebhookConfigUseCase,
      useFactory: (webhookConfigRepo: IWebhookConfigRepository) => {
        return new UpdateWebhookConfigUseCase(webhookConfigRepo);
      },
      inject: ['IWebhookConfigRepository'],
    },

    {
      provide: DeleteWebhookConfigUseCase,
      useFactory: (webhookConfigRepo: IWebhookConfigRepository) => {
        return new DeleteWebhookConfigUseCase(webhookConfigRepo);
      },
      inject: ['IWebhookConfigRepository'],
    },

    {
      provide: TestWebhookConfigUseCase,
      useFactory: (
        webhookConfigRepo: IWebhookConfigRepository,
        webhookLogRepo: IWebhookLogRepository,
        webhookSender: WebhookHttpClientService,
        hmacSigner: HmacSignerService,
        encryption: EncryptionService,
      ) => {
        return new TestWebhookConfigUseCase(
          webhookConfigRepo,
          webhookLogRepo,
          webhookSender,
          hmacSigner,
          encryption,
        );
      },
      inject: [
        'IWebhookConfigRepository',
        'IWebhookLogRepository',
        WebhookHttpClientService,
        HmacSignerService,
        EncryptionService,
      ],
    },

    {
      provide: ListWebhookLogsUseCase,
      useFactory: (
        webhookLogRepo: IWebhookLogRepository,
        webhookConfigRepo: IWebhookConfigRepository,
      ) => {
        return new ListWebhookLogsUseCase(webhookLogRepo, webhookConfigRepo);
      },
      inject: ['IWebhookLogRepository', 'IWebhookConfigRepository'],
    },

    {
      provide: RetryWebhookLogUseCase,
      useFactory: (
        webhookLogRepo: IWebhookLogRepository,
        webhookConfigRepo: IWebhookConfigRepository,
        webhookSender: WebhookHttpClientService,
        hmacSigner: HmacSignerService,
        encryption: EncryptionService,
      ) => {
        return new RetryWebhookLogUseCase(
          webhookLogRepo,
          webhookConfigRepo,
          webhookSender,
          hmacSigner,
          encryption,
        );
      },
      inject: [
        'IWebhookLogRepository',
        'IWebhookConfigRepository',
        WebhookHttpClientService,
        HmacSignerService,
        EncryptionService,
      ],
    },
  ],
  exports: [
    CreateWebhookConfigUseCase,
    ListWebhookConfigsUseCase,
    GetWebhookConfigUseCase,
    UpdateWebhookConfigUseCase,
    DeleteWebhookConfigUseCase,
    TestWebhookConfigUseCase,
    ListWebhookLogsUseCase,
    RetryWebhookLogUseCase,
  ],
})
export class WebhookModule {}
