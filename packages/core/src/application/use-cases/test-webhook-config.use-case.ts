import {
  IWebhookConfigRepository,
  IWebhookLogRepository,
  IWebhookSenderPort,
  IHmacSignerPort,
  IEncryptionPort,
  WebhookConfig,
  WebhookLog,
  WebhookConfigNotFoundError,
  WebhookResponse,
} from '../..';

/**
 * Input for testing a webhook config.
 */
export interface ITestWebhookConfigInput {
  configId: string;
  storeId: string;
  requestId?: string;
}

/**
 * Output of testing a webhook config.
 */
export interface ITestWebhookConfigOutput {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  webhookConfig: WebhookConfig;
}

/**
 * Use case for testing a webhook configuration.
 *
 * Sends a test webhook to the configured URL and logs the result.
 */
export class TestWebhookConfigUseCase {
  constructor(
    private readonly webhookConfigRepository: IWebhookConfigRepository,
    private readonly webhookLogRepository: IWebhookLogRepository,
    private readonly webhookSender: IWebhookSenderPort,
    private readonly hmacSigner: IHmacSignerPort,
    private readonly encryption: IEncryptionPort,
  ) {}

  async execute(input: ITestWebhookConfigInput): Promise<ITestWebhookConfigOutput> {
    const webhookConfig = await this.webhookConfigRepository.findById(input.configId);

    if (!webhookConfig) {
      throw new WebhookConfigNotFoundError(input.configId);
    }

    // Validate ownership
    if (webhookConfig.storeId !== input.storeId) {
      throw new WebhookConfigNotFoundError(input.configId);
    }

    // Decrypt the secret
    const plainSecret = this.encryption.decrypt(webhookConfig.secret);

    // Create test payload
    const timestamp = Math.floor(Date.now() / 1000);
    const testPayload = {
      test: true,
      timestamp,
      message: 'This is a test webhook from Hockpay',
      configId: webhookConfig.id,
    };

    // Sign the payload
    const signature = this.hmacSigner.sign(plainSecret, testPayload, timestamp);

    const log = WebhookLog.create({
      configId: webhookConfig.id,
      requestId: input.requestId,
      eventType: 'webhook.test',
      payload: testPayload,
      maxAttempts: 1,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Hockpay-Signature': signature,
      'X-Hockpay-Timestamp': timestamp.toString(),
      'X-Hockpay-Webhook-Id': log.id,
      ...(input.requestId ? { 'X-Request-ID': input.requestId } : {}),
      'X-Hockpay-Test': 'true',
      'User-Agent': 'Hockpay-Webhook/1.0',
    };

    log.setRequestHeaders(headers);

    try {
      // Send the webhook
      const response: WebhookResponse = await this.webhookSender.send(
        webhookConfig.url,
        testPayload,
        headers,
      );

      if (response.success) {
        log.recordSuccess(response.statusCode, response.body);
      } else {
        log.recordFailure(response.statusCode ?? 0, response.body);
      }

      // Save log
      await this.webhookLogRepository.save(log);

      return {
        success: response.success,
        statusCode: response.statusCode,
        responseBody: response.body,
        webhookConfig,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.recordFailure(0, errorMessage);
      await this.webhookLogRepository.save(log);

      return {
        success: false,
        error: errorMessage,
        webhookConfig,
      };
    }
  }
}
