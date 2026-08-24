import { AlertConfig } from '../../domain/entities/alert-config.entity';
import { AlertDeliveryLog } from '../../domain/entities/alert-delivery-log.entity';
import { IAlertConfigRepository } from '../../domain/repositories/alert-config.repository.interface';
import { IAlertDeliveryLogRepository } from '../../domain/repositories/alert-delivery-log.repository.interface';
import { AlertConfigNotFoundError } from '../../domain/errors/alert-config-not-found.error';
import { IEncryptionPort } from '../ports/encryption.port';
import { IAlertSenderPort } from '../ports/alert-sender.port';
import { decryptAlertConfig } from './alert-config.helpers';

export interface ITestAlertConfigInput {
  storeId: string;
  configId: string;
}

export interface ITestAlertConfigOutput {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  alertConfig: AlertConfig;
  log: AlertDeliveryLog;
}

export class TestAlertConfigUseCase {
  constructor(
    private readonly alertConfigRepository: IAlertConfigRepository,
    private readonly alertLogRepository: IAlertDeliveryLogRepository,
    private readonly alertSender: IAlertSenderPort,
    private readonly encryption: IEncryptionPort,
  ) {}

  async execute(input: ITestAlertConfigInput): Promise<ITestAlertConfigOutput> {
    const alertConfig = await this.alertConfigRepository.findById(input.configId);

    if (!alertConfig || alertConfig.storeId !== input.storeId) {
      throw new AlertConfigNotFoundError(input.configId);
    }

    const payload = {
      test: true,
      message: 'Teste de alerta Hockpay',
      alertConfigId: alertConfig.id,
      createdAt: new Date().toISOString(),
    };

    const log = AlertDeliveryLog.create({
      alertConfigId: alertConfig.id,
      outboxEventId: `test:${crypto.randomUUID()}`,
      eventType: 'alert.test',
      channel: alertConfig.channel,
      payload,
      maxAttempts: 1,
    });

    const response = await this.alertSender.send({
      channel: alertConfig.channel,
      decryptedConfig: decryptAlertConfig(alertConfig.encryptedConfig, this.encryption),
      eventType: 'alert.test',
      payload,
      test: true,
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

    await this.alertLogRepository.save(log);

    return {
      success: response.success,
      statusCode: response.statusCode,
      responseBody: response.body,
      error: response.success ? undefined : response.body,
      alertConfig,
      log,
    };
  }
}
