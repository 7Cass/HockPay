import { IOutboxRepository } from '../../domain/repositories/outbox.repository.interface';
import { IAlertConfigRepository } from '../../domain/repositories/alert-config.repository.interface';
import { IAlertDeliveryLogRepository } from '../../domain/repositories/alert-delivery-log.repository.interface';
import { AlertDeliveryLog } from '../../domain/entities/alert-delivery-log.entity';
import { IAlertSenderPort } from '../ports/alert-sender.port';
import { IEncryptionPort } from '../ports/encryption.port';
import { decryptAlertConfig } from './alert-config.helpers';

export interface IProcessAlertDeliveryInput {
  eventId: string;
  requestId?: string;
}

export interface IProcessAlertDeliveryOutput {
  processed: number;
  delivered: number;
  failed: number;
  skipped: number;
}

export class ProcessAlertDeliveryUseCase {
  constructor(
    private readonly outboxRepository: IOutboxRepository,
    private readonly alertConfigRepository: IAlertConfigRepository,
    private readonly alertLogRepository: IAlertDeliveryLogRepository,
    private readonly alertSender: IAlertSenderPort,
    private readonly encryption: IEncryptionPort,
  ) {}

  async execute(input: IProcessAlertDeliveryInput): Promise<IProcessAlertDeliveryOutput> {
    const event = await this.outboxRepository.findById(input.eventId);

    if (!event) {
      return { processed: 0, delivered: 0, failed: 0, skipped: 1 };
    }

    const storeId = this.extractStoreId(event.payload);
    if (!storeId) {
      return { processed: 0, delivered: 0, failed: 0, skipped: 1 };
    }

    const configs = await this.alertConfigRepository.findActiveForEvent(storeId, event.eventType);
    let delivered = 0;
    let failed = 0;
    let skipped = 0;

    for (const config of configs) {
      let log = await this.alertLogRepository.findByAlertConfigIdAndOutboxEventId(
        config.id,
        event.id,
      );

      if (log?.isDelivered()) {
        skipped++;
        continue;
      }

      if (log) {
        log.markRetryAttempt();
      } else {
        log = AlertDeliveryLog.create({
          alertConfigId: config.id,
          outboxEventId: event.id,
          paymentId: this.extractPaymentId(event.payload),
          eventType: event.eventType,
          channel: config.channel,
          payload: event.payload,
        });
        await this.alertLogRepository.save(log);
      }

      const response = await this.alertSender.send({
        channel: config.channel,
        decryptedConfig: decryptAlertConfig(config.encryptedConfig, this.encryption),
        eventType: event.eventType,
        payload: event.payload,
      });

      if (response.success) {
        log.recordSuccess(response.statusCode, response.body);
        delivered++;
      } else {
        log.recordFailure(
          response.statusCode,
          response.body,
          response.body,
          response.retryAfterSeconds,
        );
        failed++;
      }

      await this.alertLogRepository.update(log);
    }

    return {
      processed: configs.length,
      delivered,
      failed,
      skipped,
    };
  }

  private extractStoreId(payload: Record<string, unknown>): string | undefined {
    if (typeof payload.storeId === 'string') return payload.storeId;
    if (payload.payment && typeof payload.payment === 'object') {
      const payment = payload.payment as Record<string, unknown>;
      if (typeof payment.storeId === 'string') return payment.storeId;
    }
    return undefined;
  }

  private extractPaymentId(payload: Record<string, unknown>): string | undefined {
    if (typeof payload.id === 'string') return payload.id;
    if (payload.payment && typeof payload.payment === 'object') {
      const payment = payload.payment as Record<string, unknown>;
      if (typeof payment.id === 'string') return payment.id;
    }
    return undefined;
  }
}
