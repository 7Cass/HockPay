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
import { PaymentObject } from "../../domain/entities/payment.entity";

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
    private readonly encryption: IEncryptionPort,
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

    // Get store ID from payload
    const payload = event.payload as Record<string, unknown>;

    // Outbox events from payment might nest the data under 'payment' or another key depending on serialization
    // Wait, let's just make sure we find the storeId anywhere in the payload
    let storeId = payload.storeId as string | undefined;

    if (!storeId && payload.payment) {
      storeId = (payload.payment as Record<string, unknown>).storeId as
        | string
        | undefined;
    }

    if (!storeId) {
      // If we genuinely cannot find a storeId in the payload, the webhook is untargetable.
      // We must mark it as processed to stop the dispatch infinite loop.
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
  private async sendWebhook(
    event: OutboxEvent,
    config: WebhookConfig,
  ): Promise<{ success: boolean; error?: string }> {
    const timestamp = Date.now();
    const webhookId = crypto.randomUUID();

    // Build webhook envelope payload (Stripe-like format)
    const webhookPayload: WebhookEventPayload = buildWebhookEventPayload(
      event.id,
      event.eventType,
      event.createdAt,
      event.payload as unknown as PaymentObject,
    );

    // Decrypt the secret before signing
    const plainSecret = this.encryption.decrypt(config.secret);

    // Sign the envelope payload with decrypted secret
    const signature = this.hmacSigner.sign(
      plainSecret,
      webhookPayload as unknown as Record<string, unknown>,
      timestamp,
    );

    // Create log entry with envelope payload
    const log = WebhookLog.create({
      configId: config.id,
      paymentId: (event.payload as Record<string, unknown>).id as
        | string
        | undefined,
      eventType: event.eventType,
      payload: webhookPayload as unknown as Record<string, unknown>,
    });

    // Set headers
    const headers = {
      "Content-Type": "application/json",
      "X-Hockpay-Signature": signature,
      "X-Hockpay-Timestamp": String(timestamp),
      "X-Hockpay-Webhook-Id": webhookId,
      "User-Agent": "Hockpay-Webhook/1.0",
    };

    log.setRequestHeaders(headers);

    try {
      const response = await this.webhookSender.send(
        config.url,
        webhookPayload as unknown as Record<string, unknown>,
        headers,
      );

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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.recordFailure(0, errorMessage);
      await this.webhookLogRepository.save(log);
      return { success: false, error: errorMessage };
    }
  }
}
