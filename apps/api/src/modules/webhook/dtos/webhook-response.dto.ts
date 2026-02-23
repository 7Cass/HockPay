import { WebhookConfigObject, WebhookConfigPublicObject, WebhookLogObject } from '@hockpay/core';

/**
 * Response DTO for creating a webhook config.
 * Includes the plain secret - shown only once!
 */
export class WebhookConfigCreatedDto {
  id: string;
  url: string;
  secret: string; // Only shown on creation!
  prefix: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response DTO for webhook config (without secret).
 */
export class WebhookConfigDto {
  id: string;
  url: string;
  prefix: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response DTO for listing webhook configs.
 */
export class ListWebhooksResponseDto {
  webhooks: WebhookConfigDto[];
}

/**
 * Response DTO for a single webhook config.
 */
export class GetWebhookResponseDto {
  webhook: WebhookConfigDto;
}

/**
 * Response DTO for webhook test result.
 */
export class TestWebhookResponseDto {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  webhook: WebhookConfigDto;
}

/**
 * Response DTO for webhook logs.
 */
export class WebhookLogDto {
  id: string;
  configId: string;
  paymentId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

/**
 * Response DTO for listing webhook logs.
 */
export class ListWebhookLogsResponseDto {
  logs: WebhookLogDto[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Response DTO for retry result.
 */
export class RetryWebhookResponseDto {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  log: WebhookLogDto;
}

/**
 * Helper to map WebhookConfig to DTO.
 */
export function mapWebhookConfigToDto(config: WebhookConfigPublicObject | WebhookConfigObject): WebhookConfigDto {
  return {
    id: config.id,
    url: config.url,
    prefix: config.prefix,
    events: config.events,
    isActive: config.isActive,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Helper to map WebhookLog to DTO.
 */
export function mapWebhookLogToDto(log: WebhookLogObject): WebhookLogDto {
  return {
    id: log.id,
    configId: log.configId,
    paymentId: log.paymentId,
    eventType: log.eventType,
    payload: log.payload,
    responseStatus: log.responseStatus,
    responseBody: log.responseBody,
    attempt: log.attempt,
    maxAttempts: log.maxAttempts,
    nextRetryAt: log.nextRetryAt,
    deliveredAt: log.deliveredAt,
    createdAt: log.createdAt,
  };
}
