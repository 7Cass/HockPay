import { AlertChannel, AlertEncryptedConfig } from '../../domain/entities/alert-config.entity';

export interface AlertSendInput {
  channel: AlertChannel;
  decryptedConfig: AlertEncryptedConfig;
  eventType: string;
  payload: Record<string, unknown>;
  test?: boolean;
}

export interface AlertSendResponse {
  statusCode: number;
  body?: string;
  success: boolean;
  retryAfterSeconds?: number;
}

export interface IAlertSenderPort {
  send(input: AlertSendInput): Promise<AlertSendResponse>;
}
