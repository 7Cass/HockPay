import {
  CLOSED_WEBHOOK_CIRCUIT,
  WebhookCircuitSnapshot,
  WebhookConfigObject,
  WebhookConfigPublicObject,
  WebhookInboxEventObject,
  WebhookLogObject,
} from '@hockpay/core';

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
 * Estado do circuit breaker daquele destino, para o lojista ver que o endpoint
 * dele esta fora antes de abrir chamado perguntando por que parou de receber.
 */
export class WebhookCircuitDto {
  state: 'closed' | 'open';
  consecutiveFailures: number;
  openUntil?: Date;
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
  circuit: WebhookCircuitDto;
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
  outboxEventId?: string;
  requestId?: string;
  deliveryId: string;
  eventType: string;
  payload: Record<string, unknown>;
  requestHeaders?: Record<string, string>;
  responseStatus?: number;
  responseBody?: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  lastError?: string;
  createdAt: Date;
}

export class WebhookInboxEventDto {
  id: string;
  storeId: string;
  configId: string;
  eventType: string;
  payload: Record<string, unknown>;
  requestHeaders?: Record<string, string>;
  requestId?: string;
  deliveryId?: string;
  outboxEventId?: string;
  paymentId?: string;
  signatureValid: boolean;
  receivedAt: Date;
}

export class ListWebhookInboxEventsResponseDto {
  events: WebhookInboxEventDto[];
  total: number;
  page: number;
  limit: number;
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
export function mapWebhookConfigToDto(
  config: WebhookConfigPublicObject | WebhookConfigObject,
  circuit: WebhookCircuitSnapshot = CLOSED_WEBHOOK_CIRCUIT,
): WebhookConfigDto {
  return {
    id: config.id,
    url: config.url,
    prefix: config.prefix,
    events: config.events,
    isActive: config.isActive,
    circuit: {
      state: circuit.state,
      consecutiveFailures: circuit.consecutiveFailures,
      ...(circuit.openUntil ? { openUntil: circuit.openUntil } : {}),
    },
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
    outboxEventId: log.outboxEventId,
    requestId: log.requestId,
    deliveryId: log.id,
    eventType: log.eventType,
    payload: log.payload,
    requestHeaders: sanitizeRequestHeaders(log.requestHeaders),
    responseStatus: log.responseStatus,
    responseBody: log.responseBody,
    status: log.status,
    attempt: log.attempt,
    maxAttempts: log.maxAttempts,
    nextRetryAt: log.nextRetryAt,
    deliveredAt: log.deliveredAt,
    failedAt: log.failedAt,
    lastError: log.lastError,
    createdAt: log.createdAt,
  };
}

export function mapWebhookInboxEventToDto(
  event: WebhookInboxEventObject,
): WebhookInboxEventDto {
  return {
    id: event.id,
    storeId: event.storeId,
    configId: event.configId,
    eventType: event.eventType,
    payload: event.payload,
    requestHeaders: sanitizeRequestHeaders(event.requestHeaders),
    requestId: event.requestId,
    deliveryId: event.deliveryId,
    outboxEventId: event.outboxEventId,
    paymentId: event.paymentId,
    signatureValid: event.signatureValid,
    receivedAt: event.receivedAt,
  };
}

function sanitizeRequestHeaders(
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) return undefined;

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      if (key.toLowerCase() === 'x-hockpay-signature') {
        return [key, maskHeaderValue(value)];
      }
      return [key, value];
    }),
  );
}

function maskHeaderValue(value: string): string {
  if (value.length <= 12) return '[REDACTED]';
  return `${value.slice(0, 8)}...[REDACTED]`;
}
