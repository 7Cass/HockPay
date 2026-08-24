import { AlertDeliveryLog } from '../../domain/entities/alert-delivery-log.entity';
import { IAlertConfigRepository } from '../../domain/repositories/alert-config.repository.interface';
import { IAlertDeliveryLogRepository } from '../../domain/repositories/alert-delivery-log.repository.interface';
import { AlertConfigNotFoundError } from '../../domain/errors/alert-config-not-found.error';
import { AlertDeliveryLogNotFoundError } from '../../domain/errors/alert-delivery-log-not-found.error';
import { IEncryptionPort } from '../ports/encryption.port';
import { IAlertSenderPort } from '../ports/alert-sender.port';
import { decryptAlertConfig } from './alert-config.helpers';

export interface IRetryAlertDeliveryLogInput {
  storeId: string;
  configId: string;
  logId: string;
}

export interface IRetryAlertDeliveryLogOutput {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  log: AlertDeliveryLog;
}

export class RetryAlertDeliveryLogUseCase {
  constructor(
    private readonly alertLogRepository: IAlertDeliveryLogRepository,
    private readonly alertConfigRepository: IAlertConfigRepository,
    private readonly alertSender: IAlertSenderPort,
    private readonly encryption: IEncryptionPort,
  ) {}

  async execute(input: IRetryAlertDeliveryLogInput): Promise<IRetryAlertDeliveryLogOutput> {
    const alertConfig = await this.alertConfigRepository.findById(input.configId);

    if (!alertConfig || alertConfig.storeId !== input.storeId) {
      throw new AlertConfigNotFoundError(input.configId);
    }

    const log = await this.alertLogRepository.findById(input.logId);
    if (!log || log.alertConfigId !== alertConfig.id) {
      throw new AlertDeliveryLogNotFoundError(input.logId);
    }

    if (log.isDelivered()) {
      return {
        success: true,
        statusCode: log.responseStatus,
        responseBody: log.responseBody,
        log,
      };
    }

    log.markRetryAttempt();

    const response = await this.alertSender.send({
      channel: alertConfig.channel,
      decryptedConfig: decryptAlertConfig(alertConfig.encryptedConfig, this.encryption),
      eventType: log.eventType,
      payload: log.payload,
      test: log.outboxEventId.startsWith('test:'),
    });

    if (response.success) {
      log.recordSuccess(response.statusCode, response.body);
    } else {
      log.recordFailure(
        response.statusCode,
        response.body,
        response.body,
        response.retryAfterSeconds,
      );
    }

    await this.alertLogRepository.update(log);

    return {
      success: response.success,
      statusCode: response.statusCode,
      responseBody: response.body,
      error: response.success ? undefined : response.body,
      log,
    };
  }
}
