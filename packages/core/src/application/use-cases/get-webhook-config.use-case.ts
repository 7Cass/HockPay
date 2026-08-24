import { IWebhookConfigRepository, WebhookConfig, WebhookConfigNotFoundError } from '../..';

/**
 * Input for getting a webhook config.
 */
export interface IGetWebhookConfigInput {
  configId: string;
  storeId: string;
}

/**
 * Output of getting a webhook config.
 */
export interface IGetWebhookConfigOutput {
  webhookConfig: WebhookConfig;
}

/**
 * Use case for getting a single webhook configuration.
 * Validates that the config belongs to the store.
 */
export class GetWebhookConfigUseCase {
  constructor(private readonly webhookConfigRepository: IWebhookConfigRepository) {}

  async execute(input: IGetWebhookConfigInput): Promise<IGetWebhookConfigOutput> {
    const webhookConfig = await this.webhookConfigRepository.findById(input.configId);

    if (!webhookConfig) {
      throw new WebhookConfigNotFoundError(input.configId);
    }

    // Validate ownership
    if (webhookConfig.storeId !== input.storeId) {
      throw new WebhookConfigNotFoundError(input.configId);
    }

    return { webhookConfig };
  }
}
