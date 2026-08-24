import { Logger, Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookInboxController } from './webhook-inbox.controller';
import {
  CreateWebhookConfigUseCase,
  CreateWebhookInboxUseCase,
  ListWebhookConfigsUseCase,
  GetWebhookConfigUseCase,
  UpdateWebhookConfigUseCase,
  DeleteWebhookConfigUseCase,
  TestWebhookConfigUseCase,
  ListWebhookLogsUseCase,
  ListWebhookInboxEventsUseCase,
  ReceiveWebhookInboxEventUseCase,
  RetryWebhookLogUseCase,
  IWebhookConfigRepository,
  IWebhookInboxEventRepository,
  IWebhookLogRepository,
  getWebhookUrlPolicyOptionsForNodeEnv,
} from '@hockpay/core';
import {
  EncryptionService,
  getRequiredEnv,
  HmacSignerService,
  WebhookHttpClientService,
  WebhookConfigRepository,
  WebhookInboxEventRepository,
  WebhookLogRepository,
} from '@hockpay/infrastructure';
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
  controllers: [WebhookController, WebhookInboxController],
  providers: [
    // Infrastructure
    JwtService,
    {
      provide: EncryptionService,
      useFactory: () => new EncryptionService(getRequiredEnv('ENCRYPTION_KEY')),
    },
    {
      provide: HmacSignerService,
      useFactory: () => new HmacSignerService(),
    },
    {
      provide: WebhookHttpClientService,
      useFactory: () =>
        new WebhookHttpClientService({
          logger: new Logger(WebhookHttpClientService.name),
          webhookUrlPolicyOptions: getWebhookUrlPolicyOptionsForNodeEnv(
            process.env.NODE_ENV,
          ),
        }),
    },
    TokenGeneratorService,

    // CombinedAuthGuard (uses ValidateApiKeyUseCase from ApiKeyModule, JwtService)
    CombinedAuthGuard,

    // Factory providers for shared repositories (from @hockpay/infrastructure)
    {
      provide: 'IWebhookConfigRepository',
      useFactory: (prisma: PrismaService) =>
        new WebhookConfigRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IWebhookLogRepository',
      useFactory: (prisma: PrismaService) => new WebhookLogRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IWebhookInboxEventRepository',
      useFactory: (prisma: PrismaService) =>
        new WebhookInboxEventRepository(prisma),
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
          getWebhookUrlPolicyOptionsForNodeEnv(process.env.NODE_ENV),
        );
      },
      inject: [
        'IWebhookConfigRepository',
        TokenGeneratorService,
        EncryptionService,
      ],
    },

    {
      provide: CreateWebhookInboxUseCase,
      useFactory: (
        webhookConfigRepo: IWebhookConfigRepository,
        tokenGenerator: TokenGeneratorService,
        encryption: EncryptionService,
      ) => {
        return new CreateWebhookInboxUseCase(
          webhookConfigRepo,
          tokenGenerator,
          encryption,
        );
      },
      inject: [
        'IWebhookConfigRepository',
        TokenGeneratorService,
        EncryptionService,
      ],
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
        return new UpdateWebhookConfigUseCase(
          webhookConfigRepo,
          getWebhookUrlPolicyOptionsForNodeEnv(process.env.NODE_ENV),
        );
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
      provide: ListWebhookInboxEventsUseCase,
      useFactory: (
        webhookInboxEventRepo: IWebhookInboxEventRepository,
        webhookConfigRepo: IWebhookConfigRepository,
      ) => {
        return new ListWebhookInboxEventsUseCase(
          webhookInboxEventRepo,
          webhookConfigRepo,
        );
      },
      inject: ['IWebhookInboxEventRepository', 'IWebhookConfigRepository'],
    },

    {
      provide: ReceiveWebhookInboxEventUseCase,
      useFactory: (
        webhookConfigRepo: IWebhookConfigRepository,
        webhookInboxEventRepo: IWebhookInboxEventRepository,
        hmacSigner: HmacSignerService,
        encryption: EncryptionService,
      ) => {
        return new ReceiveWebhookInboxEventUseCase(
          webhookConfigRepo,
          webhookInboxEventRepo,
          hmacSigner,
          encryption,
        );
      },
      inject: [
        'IWebhookConfigRepository',
        'IWebhookInboxEventRepository',
        HmacSignerService,
        EncryptionService,
      ],
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
          new Logger(RetryWebhookLogUseCase.name),
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
    CreateWebhookInboxUseCase,
    ListWebhookConfigsUseCase,
    GetWebhookConfigUseCase,
    UpdateWebhookConfigUseCase,
    DeleteWebhookConfigUseCase,
    TestWebhookConfigUseCase,
    ListWebhookLogsUseCase,
    ListWebhookInboxEventsUseCase,
    ReceiveWebhookInboxEventUseCase,
    RetryWebhookLogUseCase,
  ],
})
export class WebhookModule {}
