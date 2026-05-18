import {
  OutboxEvent,
  OutboxEventObject,
  OutboxEventStatus,
} from "../../domain/entities/outbox-event.entity";
import {
  WebhookConfig,
  WebhookConfigObject,
} from "../../domain/entities/webhook-config.entity";
import { WebhookLog } from "../../domain/entities/webhook-log.entity";
import { IOutboxRepository } from "../../domain/repositories/outbox.repository.interface";
import { IWebhookConfigRepository } from "../../domain/repositories/webhook-config.repository.interface";
import { IWebhookLogRepository } from "../../domain/repositories/webhook-log.repository.interface";
import { IWebhookSenderPort } from "../ports/webhook-sender.port";
import { IHmacSignerPort } from "../ports/hmac-signer.port";
import { IEncryptionPort } from "../ports/encryption.port";
import {
  buildWebhookEventPayload,
  WebhookEventPayload,
} from "../services/webhook-payload-builder.service";

type OperationalLogger = {
  debug(message: string): void;
  warn(message: string): void;
};

/**
 * Input DTO for ProcessWebhookUseCase.
 */
export interface IProcessWebhookInput {
  eventId: string;
  requestId?: string;
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
    private readonly encryption: IEncryptionPort,
    private readonly logger?: OperationalLogger,
  ) {}

  async execute(input: IProcessWebhookInput): Promise<IProcessWebhookOutput> {
    // Find event
    const event = await this.outboxRepository.findById(input.eventId);

    if (!event) {
      return {
        event: {
          id: input.eventId,
          aggregateType: "",
          aggregateId: "",
          eventType: "",
          payload: {},
          status: OutboxEventStatus.FAILED,
          retryCount: 0,
          maxRetries: 5,
          createdAt: new Date(),
        },
        delivered: false,
        error: "Event not found",
      };
    }

    // Skip if already processed
    if (event.isProcessed()) {
      return {
        event: event.toObject(),
        delivered: true,
      };
    }

    const payload = event.payload as Record<string, unknown>;
    const storeId =
      typeof payload.storeId === "string" ? payload.storeId : undefined;

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

    const results = await Promise.all(
      configs.map((config) =>
        this.sendWebhookSafely(event, config, event.requestId ?? input.requestId),
      ),
    );
    const allSucceeded = results.every((result) => result.success);
    const lastError = [...results]
      .reverse()
      .find((result) => !result.success)?.error;

    if (allSucceeded) {
      event.markAsProcessed();
      await this.outboxRepository.update(event);
    }

    return {
      event: event.toObject(),
      delivered: allSucceeded,
      error: lastError,
    };
  }

  /**
   * Send webhook to a single config.
   */
  private async sendWebhookSafely(
    event: OutboxEvent,
    config: WebhookConfig,
    requestId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.sendWebhook(event, config, requestId);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async sendWebhook(
    event: OutboxEvent,
    config: WebhookConfig,
    requestId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const timestamp = Date.now();
    const aggregatePayload = event.payload as Record<string, unknown>;
    const aggregateId =
      typeof aggregatePayload.id === "string" ? aggregatePayload.id : event.aggregateId;
    const paymentId = event.aggregateType === "Payment" ? aggregateId : undefined;

    // Build webhook envelope payload (Stripe-like format)
    const webhookPayload: WebhookEventPayload = buildWebhookEventPayload(
      event.id,
      event.eventType,
      event.createdAt,
      aggregatePayload,
    );

    const log = WebhookLog.create({
      configId: config.id,
      paymentId,
      aggregateType: event.aggregateType,
      aggregateId,
      outboxEventId: event.id,
      requestId,
      eventType: event.eventType,
      payload: webhookPayload as unknown as Record<string, unknown>,
    });
    const webhookId = log.id;

    this.logger?.debug(
      `Sending webhook requestId=${requestId ?? "unknown"} outboxEventId=${event.id} paymentId=${paymentId ?? "unknown"} webhookConfigId=${config.id} deliveryId=${webhookId}`,
    );

    try {
      const plainSecret = this.encryption.decrypt(config.secret);
      const signature = this.hmacSigner.sign(
        plainSecret,
        webhookPayload as unknown as Record<string, unknown>,
        timestamp,
      );
      const headers = {
        "Content-Type": "application/json",
        "X-Hockpay-Signature": signature,
        "X-Hockpay-Timestamp": String(timestamp),
        "X-Hockpay-Webhook-Id": webhookId,
        ...(requestId ? { "X-Request-ID": requestId } : {}),
        "User-Agent": "Hockpay-Webhook/1.0",
      };

      log.setRequestHeaders(headers);
      const response = await this.webhookSender.send(
        config.url,
        webhookPayload as unknown as Record<string, unknown>,
        headers,
      );

      if (response.success) {
        log.recordSuccess(response.statusCode, response.body);
        await this.webhookLogRepository.save(log);
        this.logger?.debug(
          `Webhook delivered requestId=${requestId ?? "unknown"} outboxEventId=${event.id} paymentId=${paymentId ?? "unknown"} webhookConfigId=${config.id} deliveryId=${webhookId}`,
        );
        return { success: true };
      } else {
        log.recordFailure(response.statusCode, response.body);
        await this.webhookLogRepository.save(log);
        this.logger?.warn(
          `Webhook delivery rejected requestId=${requestId ?? "unknown"} outboxEventId=${event.id} paymentId=${paymentId ?? "unknown"} webhookConfigId=${config.id} deliveryId=${webhookId} statusCode=${response.statusCode}`,
        );
        return { success: false, error: `HTTP ${response.statusCode}` };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.recordFailure(0, errorMessage);
      await this.webhookLogRepository.save(log);
      this.logger?.warn(
        `Webhook delivery failed requestId=${requestId ?? "unknown"} outboxEventId=${event.id} paymentId=${paymentId ?? "unknown"} webhookConfigId=${config.id} deliveryId=${webhookId} error=${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }
}
