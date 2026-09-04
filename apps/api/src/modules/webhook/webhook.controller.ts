import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
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
  RetryWebhookLogUseCase,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { CreateWebhookDto } from './dtos/create-webhook.dto';
import { UpdateWebhookDto } from './dtos/update-webhook.dto';
import {
  WebhookConfigCreatedDto,
  ListWebhooksResponseDto,
  GetWebhookResponseDto,
  TestWebhookResponseDto,
  ListWebhookLogsResponseDto,
  ListWebhookInboxEventsResponseDto,
  RetryWebhookResponseDto,
  mapWebhookInboxEventToDto,
  mapWebhookConfigToDto,
  mapWebhookLogToDto,
} from './dtos/webhook-response.dto';
import { ListWebhookLogsQueryDto } from './dtos/list-webhook-logs.dto';
import { CreateWebhookInboxDto } from './dtos/create-webhook-inbox.dto';
import { ListWebhookInboxEventsQueryDto } from './dtos/list-webhook-inbox-events.dto';
import { getRequestId } from '../../common/request-id';

/**
 * Controller for Webhook endpoints.
 *
 * This controller handles webhook CRUD operations and testing.
 * Business logic is delegated to the use cases from the core layer.
 *
 * Authentication:
 * - All routes use CombinedAuthGuard (API Key OR JWT Cookie)
 */
@Controller('webhooks')
@Public()
@UseGuards(CombinedAuthGuard)
export class WebhookController {
  constructor(
    private readonly createWebhookConfigUseCase: CreateWebhookConfigUseCase,
    private readonly createWebhookInboxUseCase: CreateWebhookInboxUseCase,
    private readonly listWebhookConfigsUseCase: ListWebhookConfigsUseCase,
    private readonly getWebhookConfigUseCase: GetWebhookConfigUseCase,
    private readonly updateWebhookConfigUseCase: UpdateWebhookConfigUseCase,
    private readonly deleteWebhookConfigUseCase: DeleteWebhookConfigUseCase,
    private readonly testWebhookConfigUseCase: TestWebhookConfigUseCase,
    private readonly listWebhookLogsUseCase: ListWebhookLogsUseCase,
    private readonly listWebhookInboxEventsUseCase: ListWebhookInboxEventsUseCase,
    private readonly retryWebhookLogUseCase: RetryWebhookLogUseCase,
  ) {}

  /**
   * POST /api/v1/webhooks
   *
   * Creates a new webhook config.
   * Returns the plain secret only once!
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateWebhookDto,
    @CurrentStore() storeId: string,
  ): Promise<WebhookConfigCreatedDto> {
    const result = await this.createWebhookConfigUseCase.execute({
      storeId,
      url: this.validateWebhookTargetUrl(dto.url),
      events: dto.events,
    });

    return {
      id: result.webhookConfig.id,
      url: result.webhookConfig.url,
      secret: result.plainSecret, // Only shown once!
      prefix: result.webhookConfig.prefix,
      events: result.webhookConfig.events,
      isActive: result.webhookConfig.isActive,
      createdAt: result.webhookConfig.createdAt,
      updatedAt: result.webhookConfig.updatedAt,
    };
  }

  /**
   * POST /api/v1/webhooks/inbox
   *
   * Creates an internal test inbox webhook config.
   */
  @Post('inbox')
  @HttpCode(HttpStatus.CREATED)
  async createInbox(
    @Body() dto: CreateWebhookInboxDto,
    @CurrentStore() storeId: string,
    @Req() req: Request,
  ): Promise<WebhookConfigCreatedDto> {
    const result = await this.createWebhookInboxUseCase.execute({
      storeId,
      events: dto.events,
      baseUrl: this.resolvePublicApiBaseUrl(req),
    });

    return {
      id: result.webhookConfig.id,
      url: result.webhookConfig.url,
      secret: result.plainSecret,
      prefix: result.webhookConfig.prefix,
      events: result.webhookConfig.events,
      isActive: result.webhookConfig.isActive,
      createdAt: result.webhookConfig.createdAt,
      updatedAt: result.webhookConfig.updatedAt,
    };
  }

  /**
   * GET /api/v1/webhooks
   *
   * Lists all webhook configs for the store.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentStore() storeId: string,
  ): Promise<ListWebhooksResponseDto> {
    const result = await this.listWebhookConfigsUseCase.execute({ storeId });

    return {
      webhooks: result.webhookConfigs.map((config) =>
        mapWebhookConfigToDto(
          config.toPublicObject(),
          result.circuits[config.id],
        ),
      ),
    };
  }

  /**
   * GET /api/v1/webhooks/:id
   *
   * Gets a webhook config by ID.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
  ): Promise<GetWebhookResponseDto> {
    const result = await this.getWebhookConfigUseCase.execute({
      configId: id,
      storeId,
    });

    return {
      webhook: mapWebhookConfigToDto(result.webhookConfig.toPublicObject()),
    };
  }

  /**
   * PATCH /api/v1/webhooks/:id
   *
   * Updates a webhook config.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
    @CurrentStore() storeId: string,
  ): Promise<GetWebhookResponseDto> {
    const result = await this.updateWebhookConfigUseCase.execute({
      configId: id,
      storeId,
      url: dto.url ? this.validateWebhookTargetUrl(dto.url) : undefined,
      events: dto.events,
      isActive: dto.isActive,
    });

    return {
      webhook: mapWebhookConfigToDto(result.webhookConfig.toPublicObject()),
    };
  }

  /**
   * DELETE /api/v1/webhooks/:id
   *
   * Deletes a webhook config.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
  ): Promise<void> {
    await this.deleteWebhookConfigUseCase.execute({
      configId: id,
      storeId,
    });
  }

  /**
   * POST /api/v1/webhooks/:id/test
   *
   * Sends a test webhook to the configured URL.
   */
  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  async test(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @Req() req: Request,
  ): Promise<TestWebhookResponseDto> {
    const result = await this.testWebhookConfigUseCase.execute({
      configId: id,
      storeId,
      requestId: getRequestId(req),
    });

    return {
      success: result.success,
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      error: result.error,
      webhook: mapWebhookConfigToDto(result.webhookConfig.toPublicObject()),
    };
  }

  /**
   * GET /api/v1/webhooks/:id/logs
   *
   * Lists delivery logs for a webhook config.
   */
  @Get(':id/logs')
  @HttpCode(HttpStatus.OK)
  async listLogs(
    @Param('id') id: string,
    @Query() query: ListWebhookLogsQueryDto,
    @CurrentStore() storeId: string,
  ): Promise<ListWebhookLogsResponseDto> {
    const result = await this.listWebhookLogsUseCase.execute({
      storeId,
      configId: id,
      page: query.page,
      limit: query.limit,
      status: query.status,
    });

    return {
      logs: result.logs.map((log) => mapWebhookLogToDto(log.toObject())),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * GET /api/v1/webhooks/:id/inbox-events
   *
   * Lists events received by an internal test inbox webhook.
   */
  @Get(':id/inbox-events')
  @HttpCode(HttpStatus.OK)
  async listInboxEvents(
    @Param('id') id: string,
    @Query() query: ListWebhookInboxEventsQueryDto,
    @CurrentStore() storeId: string,
  ): Promise<ListWebhookInboxEventsResponseDto> {
    const result = await this.listWebhookInboxEventsUseCase.execute({
      storeId,
      configId: id,
      page: query.page,
      limit: query.limit,
    });

    return {
      events: result.events.map((event) =>
        mapWebhookInboxEventToDto(event.toObject()),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * POST /api/v1/webhooks/:id/logs/:logId/retry
   *
   * Retries a failed webhook delivery.
   */
  @Post(':id/logs/:logId/retry')
  @HttpCode(HttpStatus.OK)
  async retryLog(
    @Param('id') id: string,
    @Param('logId') logId: string,
    @CurrentStore() storeId: string,
    @Req() req: Request,
  ): Promise<RetryWebhookResponseDto> {
    const result = await this.retryWebhookLogUseCase.execute({
      configId: id,
      logId,
      storeId,
      requestId: getRequestId(req),
    });

    return {
      success: result.success,
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      error: result.error,
      log: mapWebhookLogToDto(result.log.toObject()),
    };
  }

  private validateWebhookTargetUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const normalizedPath = parsed.pathname.replace(/\/+$/, '');
      if (normalizedPath === '/api/v1/webhooks') {
        throw new BadRequestException({
          error: {
            code: 'INVALID_WEBHOOK_TARGET_URL',
            message:
              'This URL is the Hockpay webhook management endpoint. Use the internal test inbox or a receiver endpoint such as /api/webhook.',
          },
        });
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
    }

    return url;
  }

  private resolvePublicApiBaseUrl(req: Request): string {
    const configured =
      process.env.PUBLIC_API_BASE_URL ?? process.env.APP_URL ?? undefined;
    if (configured) {
      return configured;
    }

    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto;
    const protocol = proto ?? req.protocol ?? 'http';
    return `${protocol}://${req.get('host')}`;
  }
}
