import {
  IWebhookLogRepository,
  IWebhookConfigRepository,
  IWebhookSenderPort,
  IHmacSignerPort,
  IEncryptionPort,
  WebhookLog,
  WebhookConfigNotFoundError,
  WebhookResponse,
} from '../..';

type OperationalLogger = {
  debug(message: string): void;
  warn(message: string): void;
};

/**
 * Input for retrying a webhook log.
 */
export interface IRetryWebhookLogInput {
  logId: string;
  storeId: string;
}

/**
 * Output of retrying a webhook log.
 */
export interface IRetryWebhookLogOutput {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  log: WebhookLog;
}

/**
 * Use case for manually retrying a failed webhook delivery.
 */
export class RetryWebhookLogUseCase {
  constructor(
    private readonly webhookLogRepository: IWebhookLogRepository,
    private readonly webhookConfigRepository: IWebhookConfigRepository,
    private readonly webhookSender: IWebhookSenderPort,
    private readonly hmacSigner: IHmacSignerPort,
    private readonly encryption: IEncryptionPort,
    private readonly logger?: OperationalLogger,
  ) {}

  async execute(input: IRetryWebhookLogInput): Promise<IRetryWebhookLogOutput> {
    const log = await this.webhookLogRepository.findById(input.logId);

    if (!log) {
      throw new Error(`Webhook log not found: ${input.logId}`);
    }

    // Get config and validate ownership
    const config = await this.webhookConfigRepository.findById(log.configId);

    if (!config) {
      throw new WebhookConfigNotFoundError(log.configId);
    }

    if (config.storeId !== input.storeId) {
      throw new Error(`Webhook log not found: ${input.logId}`);
    }

    // Decrypt the secret
    const plainSecret = this.encryption.decrypt(config.secret);

    // Create timestamp and sign
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.hmacSigner.sign(plainSecret, log.payload, timestamp);

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Hockpay-Signature': signature,
      'X-Hockpay-Timestamp': timestamp.toString(),
      'X-Hockpay-Webhook-Id': log.id,
      'User-Agent': 'Hockpay-Webhook/1.0',
    };

    log.setRequestHeaders(headers);
    this.logger?.debug(
      `Retrying webhook logId=${log.id} paymentId=${log.paymentId ?? 'unknown'} webhookConfigId=${config.id} deliveryId=${log.id}`,
    );

    try {
      // Send the webhook
      const response: WebhookResponse = await this.webhookSender.send(
        config.url,
        log.payload,
        headers,
      );

      if (response.success) {
        log.recordSuccess(response.statusCode, response.body);
        this.logger?.debug(
          `Webhook retry delivered logId=${log.id} paymentId=${log.paymentId ?? 'unknown'} webhookConfigId=${config.id} deliveryId=${log.id}`,
        );
      } else {
        log.recordFailure(response.statusCode ?? 0, response.body);
        this.logger?.warn(
          `Webhook retry rejected logId=${log.id} paymentId=${log.paymentId ?? 'unknown'} webhookConfigId=${config.id} deliveryId=${log.id} statusCode=${response.statusCode ?? 0}`,
        );
      }

      // Update log
      await this.webhookLogRepository.update(log);

      return {
        success: response.success,
        statusCode: response.statusCode,
        responseBody: response.body,
        log,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.recordFailure(0, errorMessage);
      await this.webhookLogRepository.update(log);
      this.logger?.warn(
        `Webhook retry failed logId=${log.id} paymentId=${log.paymentId ?? 'unknown'} webhookConfigId=${config.id} deliveryId=${log.id} error=${errorMessage}`,
      );

      return {
        success: false,
        error: errorMessage,
        log,
      };
    }
  }
}
