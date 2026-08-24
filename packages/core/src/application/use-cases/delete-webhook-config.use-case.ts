import { IWebhookConfigRepository, WebhookConfigNotFoundError } from '../..';

/**
 * Input for deleting a webhook config.
 */
export interface IDeleteWebhookConfigInput {
  configId: string;
  storeId: string;
}

/**
 * Use case for deleting a webhook configuration.
 */
export class DeleteWebhookConfigUseCase {
  constructor(private readonly webhookConfigRepository: IWebhookConfigRepository) {}

  async execute(input: IDeleteWebhookConfigInput): Promise<void> {
    const webhookConfig = await this.webhookConfigRepository.findById(input.configId);

    if (!webhookConfig) {
      throw new WebhookConfigNotFoundError(input.configId);
    }

    // Validate ownership
    if (webhookConfig.storeId !== input.storeId) {
      throw new WebhookConfigNotFoundError(input.configId);
    }

    await this.webhookConfigRepository.delete(input.configId);
  }
}
