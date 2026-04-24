import {
  AlertConfigPublicObject,
  AlertDeliveryLogObject,
} from '@hockpay/core';

export class AlertConfigDto {
  id: string;
  name: string;
  channel: string;
  configPreview: {
    webhookUrl: string;
  };
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AlertDeliveryLogDto {
  id: string;
  alertConfigId: string;
  outboxEventId: string;
  paymentId?: string;
  eventType: string;
  channel: string;
  status: string;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

export class ListAlertsResponseDto {
  alerts: AlertConfigDto[];
}

export class GetAlertResponseDto {
  alert: AlertConfigDto;
}

export class TestAlertResponseDto {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  alert: AlertConfigDto;
  log: AlertDeliveryLogDto;
}

export class ListAlertLogsResponseDto {
  logs: AlertDeliveryLogDto[];
  total: number;
  page: number;
  limit: number;
}

export class RetryAlertLogResponseDto {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  log: AlertDeliveryLogDto;
}

export function mapAlertConfigToDto(config: AlertConfigPublicObject): AlertConfigDto {
  return {
    id: config.id,
    name: config.name,
    channel: config.channel,
    configPreview: {
      webhookUrl: config.configPreview.webhookUrl,
    },
    events: config.events,
    isActive: config.isActive,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export function mapAlertDeliveryLogToDto(log: AlertDeliveryLogObject): AlertDeliveryLogDto {
  return {
    id: log.id,
    alertConfigId: log.alertConfigId,
    outboxEventId: log.outboxEventId,
    paymentId: log.paymentId,
    eventType: log.eventType,
    channel: log.channel,
    status: log.status,
    payload: log.payload,
    responseStatus: log.responseStatus,
    responseBody: log.responseBody,
    errorMessage: log.errorMessage,
    attempt: log.attempt,
    maxAttempts: log.maxAttempts,
    nextRetryAt: log.nextRetryAt,
    deliveredAt: log.deliveredAt,
    createdAt: log.createdAt,
  };
}
