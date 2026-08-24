import { IWebhookConfigRepository, WebhookConfig } from '../..';

/**
 * Input for listing webhook configs.
 */
export interface IListWebhookConfigsInput {
  storeId: string;
}

/**
 * Output of listing webhook configs.
 */
export interface IListWebhookConfigsOutput {
  webhookConfigs: WebhookConfig[];
}

/**
 * Use case for listing all webhook configurations for a store.
 */
export class ListWebhookConfigsUseCase {
  constructor(private readonly webhookConfigRepository: IWebhookConfigRepository) {}

  async execute(input: IListWebhookConfigsInput): Promise<IListWebhookConfigsOutput> {
    const webhookConfigs = await this.webhookConfigRepository.findByStoreId(input.storeId);

    return { webhookConfigs };
  }
}
