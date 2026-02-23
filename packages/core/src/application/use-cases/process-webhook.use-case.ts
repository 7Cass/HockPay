import {
  OutboxEvent,
  OutboxEventObject,
  OutboxEventStatus,
} from '../../domain/entities/outbox-event.entity';
import {
  WebhookConfig,
  WebhookConfigObject,
} from '../../domain/entities/webhook-config.entity';
import { WebhookLog } from '../../domain/entities/webhook-log.entity';
import { IOutboxRepository } from '../../domain/repositories/outbox.repository.interface';
import { IWebhookConfigRepository } from '../../domain/repositories/webhook-config.repository.interface';
import { IWebhookLogRepository } from '../../domain/repositories/webhook-log.repository.interface';
import { IWebhookSenderPort } from '../ports/webhook-sender.port';
import { IHmacSignerPort } from '../ports/hmac-signer.port';

/**
 * Input DTO for ProcessWebhookUseCase.
 */
export interface IProcessWebhookInput {
  eventId: string;
}

/**
 * Output DTO for ProcessWebhookUseCase.
 */
export interface IProcessWebhookOutput {
  event: OutboxEventObject;
  delivered: boolean;
  error?: string;
}

/**
 * Use Case: Process Webhook
 *
 * This use case handles processing and sending webhook notifications.
 * Called by:
 * - Webhook processor (BullMQ)
 * - Outbox processor (cron)
 *
 * Business rules:
 * - Event must exist and be pending
 * - Find active webhook configs for the store/event
 * - Sign payload with HMAC-SHA256
 * - Send to all configured webhooks
 * - Log delivery attempts
 * - Handle retries with exponential backoff
 */
export class ProcessWebhookUseCase {
  constructor(
    private readonly outboxRepository: IOutboxRepository,
    private readonly webhookConfigRepository: IWebhookConfigRepository,
    private readonly webhookLogRepository: IWebhookLogRepository,
    private readonly webhookSender: IWebhookSenderPort,
    private readonly hmacSigner: IHmacSignerPort,
  ) {}

  async execute(input: IProcessWebhookInput): Promise<IProcessWebhookOutput> {
    // Find event
    const event = await this.outboxRepository.findById(input.eventId);

    if (!event) {
      return {
        event: {
          id: input.eventId,
          aggregateType: '',
          aggregateId: '',
          eventType: '',
          payload: {},
          status: OutboxEventStatus.FAILED,
          retryCount: 0,
          maxRetries: 5,
          createdAt: new Date(),
        },
        delivered: false,
        error: 'Event not found',
      };
    }

    // Skip if already processed
    if (event.isProcessed()) {
      return {
        event: event.toObject(),
        delivered: true,
      };
    }

    // Get store ID from payload
    const payload = event.payload as Record<string, unknown>;
    const storeId = payload.storeId as string | undefined;

    if (!storeId) {
      event.markAsProcessed();
      await this.outboxRepository.update(event);
      return {
        event: event.toObject(),
        delivered: true,
      };
    }

    // Find active webhook configs
    const configs = await this.webhookConfigRepository.findActiveForEvent(
      storeId,
      event.eventType,
    );

    if (configs.length === 0) {
      event.markAsProcessed();
      await this.outboxRepository.update(event);
      return {
        event: event.toObject(),
        delivered: true,
      };
    }

    // Send webhooks
    let allSucceeded = true;
    let lastError: string | undefined;

    for (const config of configs) {
      const result = await this.sendWebhook(event, config);

      if (!result.success) {
        allSucceeded = false;
        lastError = result.error;
      }
    }

    // Update event status
    if (allSucceeded) {
      event.markAsProcessed();
    } else if (event.canRetry()) {
      event.markAsFailed(lastError ?? 'Webhook delivery failed');
    } else {
      event.markAsFailed(lastError ?? 'Max retries exceeded');
    }

    await this.outboxRepository.update(event);

    return {
      event: event.toObject(),
      delivered: allSucceeded,
      error: lastError,
    };
  }

  /**
   * Send webhook to a single config.
   */
  private async sendWebhook(
    event: OutboxEvent,
    config: WebhookConfig,
  ): Promise<{ success: boolean; error?: string }> {
    const timestamp = Date.now();
    const webhookId = crypto.randomUUID();

    // Sign payload
    const signature = this.hmacSigner.sign(config.secret, event.payload, timestamp);

    // Create log entry
    const log = WebhookLog.create({
      configId: config.id,
      paymentId: (event.payload as Record<string, unknown>).paymentId as string | undefined,
      eventType: event.eventType,
      payload: event.payload,
    });

    // Set headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Hockpay-Signature': signature,
      'X-Hockpay-Timestamp': String(timestamp),
      'X-Hockpay-Webhook-Id': webhookId,
      'User-Agent': 'Hockpay-Webhook/1.0',
    };

    log.setRequestHeaders(headers);

    try {
      const response = await this.webhookSender.send(config.url, event.payload, headers);

      if (response.success) {
        log.recordSuccess(response.statusCode, response.body);
        await this.webhookLogRepository.save(log);
        return { success: true };
      } else {
        log.recordFailure(response.statusCode, response.body);
        await this.webhookLogRepository.save(log);
        return { success: false, error: `HTTP ${response.statusCode}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.recordFailure(0, errorMessage);
      await this.webhookLogRepository.save(log);
      return { success: false, error: errorMessage };
    }
  }
}
