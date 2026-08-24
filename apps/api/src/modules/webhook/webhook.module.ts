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
  getWebhookUrlPolicyOptionsForNodeEnv,
} from '@hockpay/core';
import {
  EncryptionService,
  HmacSignerService,
  WebhookHttpClientService,
} from '@hockpay/infrastructure';
import { TokenGeneratorService } from '../../infra/services/token-generator.service';
import { provideUseCase } from '../../common/provide-use-case';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';

/**
 * Webhook Module
 *
 * This module provides webhook-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 *
 * Repositorios, EncryptionService, HmacSignerService e WebhookHttpClientService
 * vem do InfrastructureModule global.
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
    CombinedAuthGuard,

    provideUseCase(
      CreateWebhookConfigUseCase,
      ['IWebhookConfigRepository', TokenGeneratorService, EncryptionService],
      () => [getWebhookUrlPolicyOptionsForNodeEnv(process.env.NODE_ENV)],
    ),
    provideUseCase(CreateWebhookInboxUseCase, [
      'IWebhookConfigRepository',
      TokenGeneratorService,
      EncryptionService,
    ]),
    provideUseCase(ListWebhookConfigsUseCase, ['IWebhookConfigRepository']),
    provideUseCase(GetWebhookConfigUseCase, ['IWebhookConfigRepository']),
    provideUseCase(
      UpdateWebhookConfigUseCase,
      ['IWebhookConfigRepository'],
      () => [getWebhookUrlPolicyOptionsForNodeEnv(process.env.NODE_ENV)],
    ),
    provideUseCase(DeleteWebhookConfigUseCase, ['IWebhookConfigRepository']),
    provideUseCase(TestWebhookConfigUseCase, [
      'IWebhookConfigRepository',
      'IWebhookLogRepository',
      WebhookHttpClientService,
      HmacSignerService,
      EncryptionService,
    ]),
    provideUseCase(ListWebhookLogsUseCase, [
      'IWebhookLogRepository',
      'IWebhookConfigRepository',
    ]),
    provideUseCase(ListWebhookInboxEventsUseCase, [
      'IWebhookInboxEventRepository',
      'IWebhookConfigRepository',
    ]),
    provideUseCase(ReceiveWebhookInboxEventUseCase, [
      'IWebhookConfigRepository',
      'IWebhookInboxEventRepository',
      HmacSignerService,
      EncryptionService,
    ]),
    provideUseCase(
      RetryWebhookLogUseCase,
      [
        'IWebhookLogRepository',
        'IWebhookConfigRepository',
        WebhookHttpClientService,
        HmacSignerService,
        EncryptionService,
      ],
      () => [new Logger(RetryWebhookLogUseCase.name)],
    ),
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
