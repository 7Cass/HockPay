import {
  OutboxEvent,
  OutboxEventObject,
  OutboxEventStatus,
} from '../../domain/entities/outbox-event.entity';
import { WebhookConfig } from '../../domain/entities/webhook-config.entity';
import { WebhookLog } from '../../domain/entities/webhook-log.entity';
import { IOutboxRepository } from '../../domain/repositories/outbox.repository.interface';
import { IWebhookConfigRepository } from '../../domain/repositories/webhook-config.repository.interface';
import { IWebhookLogRepository } from '../../domain/repositories/webhook-log.repository.interface';
import { IWebhookSenderPort } from '../ports/webhook-sender.port';
import { IHmacSignerPort } from '../ports/hmac-signer.port';
import { IEncryptionPort } from '../ports/encryption.port';
import { IWebhookCircuitBreakerPort } from '../ports/webhook-circuit-breaker.port';
import {
  buildWebhookEventPayload,
  WebhookEventPayload,
} from '../services/webhook-payload-builder.service';

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
    private readonly circuitBreaker?: IWebhookCircuitBreakerPort,
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
          version: 1,
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

    const payload = event.payload;
    const storeId = typeof payload.storeId === 'string' ? payload.storeId : undefined;

    if (!storeId) {
      event.markAsProcessed();
      await this.outboxRepository.update(event);
      return {
        event: event.toObject(),
        delivered: true,
      };
    }

    // Find active webhook configs
    const configs = await this.webhookConfigRepository.findActiveForEvent(storeId, event.eventType);

    if (configs.length === 0) {
      event.markAsProcessed();
      await this.outboxRepository.update(event);
      return {
        event: event.toObject(),
        delivered: true,
      };
    }

    // Destinos com o circuito aberto param aqui, antes de qualquer socket.
    // Segurar o evento (sem marcar processado) faz o BullMQ tentar de novo mais
    // tarde, quando a janela do breaker ja tiver passado.
    const { attemptable, open } = await this.partitionByCircuit(configs);
    const openIds = open.map((config) => config.id).join(', ');

    if (attemptable.length === 0) {
      this.logger?.warn(
        `Skipping webhook delivery outboxEventId=${event.id}: all destinations are circuit-open (${openIds})`,
      );
      return {
        event: event.toObject(),
        delivered: false,
        error: `Webhook destinations are circuit-open: ${openIds}`,
      };
    }

    const results = await Promise.all(
      attemptable.map((config) =>
        this.sendWebhookSafely(event, config, event.requestId ?? input.requestId),
      ),
    );
    // Um destino aberto nao conta como entregue: o evento precisa sobreviver
    // para ser reentregue quando o circuito fechar.
    const allSucceeded = results.every((result) => result.success) && open.length === 0;
    const lastError =
      [...results].reverse().find((result) => !result.success)?.error ??
      (open.length > 0 ? `Webhook destinations are circuit-open: ${openIds}` : undefined);

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

  private async partitionByCircuit(
    configs: WebhookConfig[],
  ): Promise<{ attemptable: WebhookConfig[]; open: WebhookConfig[] }> {
    if (!this.circuitBreaker) {
      return { attemptable: configs, open: [] };
    }

    const attemptable: WebhookConfig[] = [];
    const open: WebhookConfig[] = [];

    for (const config of configs) {
      if (await this.circuitBreaker.shouldAttempt(config.id)) {
        attemptable.push(config);
      } else {
        open.push(config);
      }
    }

    return { attemptable, open };
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
    const aggregatePayload = event.payload;
    const aggregateId =
      typeof aggregatePayload.id === 'string' ? aggregatePayload.id : event.aggregateId;
    const paymentId = event.aggregateType === 'Payment' ? aggregateId : undefined;

    // Build webhook envelope payload (Stripe-like format)
    const webhookPayload: WebhookEventPayload = buildWebhookEventPayload(
      event.id,
      event.eventType,
      event.version,
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
    const existingLog = await this.webhookLogRepository.findByConfigAndOutboxEvent(
      config.id,
      event.id,
    );
    const deliveryLog = existingLog ?? log;

    if (deliveryLog.isDelivered()) {
      this.logger?.debug(
        `Skipping already delivered webhook requestId=${requestId ?? 'unknown'} outboxEventId=${event.id} paymentId=${paymentId ?? 'unknown'} webhookConfigId=${config.id} deliveryId=${deliveryLog.id}`,
      );
      return { success: true };
    }

    deliveryLog.beginAttempt(requestId);
    const webhookId = deliveryLog.id;
    const deliveryPayload = deliveryLog.payload as unknown as WebhookEventPayload;

    this.logger?.debug(
      `Sending webhook requestId=${requestId ?? 'unknown'} outboxEventId=${event.id} paymentId=${paymentId ?? 'unknown'} webhookConfigId=${config.id} deliveryId=${webhookId}`,
    );

    try {
      const plainSecret = this.encryption.decrypt(config.secret);
      const signature = this.hmacSigner.sign(
        plainSecret,
        deliveryPayload as unknown as Record<string, unknown>,
        timestamp,
      );
      const headers = {
        'Content-Type': 'application/json',
        'X-Hockpay-Signature': signature,
        'X-Hockpay-Timestamp': String(timestamp),
        'X-Hockpay-Webhook-Id': webhookId,
        ...(requestId ? { 'X-Request-ID': requestId } : {}),
        'User-Agent': 'Hockpay-Webhook/1.0',
      };

      deliveryLog.setRequestHeaders(headers);
      const response = await this.webhookSender.send(
        config.url,
        deliveryPayload as unknown as Record<string, unknown>,
        headers,
      );

      if (response.success) {
        await this.circuitBreaker?.recordSuccess(config.id);
        deliveryLog.recordSuccess(response.statusCode, response.body);
        await this.webhookLogRepository.upsertDelivery(deliveryLog);
        this.logger?.debug(
          `Webhook delivered requestId=${requestId ?? 'unknown'} outboxEventId=${event.id} paymentId=${paymentId ?? 'unknown'} webhookConfigId=${config.id} deliveryId=${webhookId}`,
        );
        return { success: true };
      } else {
        // So `transport` conta: um 4xx e a aplicacao do lojista respondendo, e
        // um `blocked` nem chegou a abrir socket. Nenhum dos dois trava a fila.
        if (response.failureKind === 'transport') {
          await this.circuitBreaker?.recordTransportFailure(config.id);
        }
        deliveryLog.recordFailure(response.statusCode, response.body);
        await this.webhookLogRepository.upsertDelivery(deliveryLog);
        this.logger?.warn(
          `Webhook delivery rejected requestId=${requestId ?? 'unknown'} outboxEventId=${event.id} paymentId=${paymentId ?? 'unknown'} webhookConfigId=${config.id} deliveryId=${webhookId} statusCode=${response.statusCode}`,
        );
        return { success: false, error: `HTTP ${response.statusCode}` };
      }
    } catch (error) {
      // Excecao aqui e o socket morrendo por baixo do sender: conta como falha
      // de transporte, que e exatamente o caso que o breaker existe para cortar.
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.circuitBreaker?.recordTransportFailure(config.id);
      deliveryLog.recordFailure(0, errorMessage);
      await this.webhookLogRepository.upsertDelivery(deliveryLog);
      this.logger?.warn(
        `Webhook delivery failed requestId=${requestId ?? 'unknown'} outboxEventId=${event.id} paymentId=${paymentId ?? 'unknown'} webhookConfigId=${config.id} deliveryId=${webhookId} error=${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }
}
