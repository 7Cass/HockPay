import { WebhookInboxEvent } from '../entities/webhook-inbox-event.entity';

export interface ListWebhookInboxEventsOptions {
  page?: number;
  limit?: number;
}

export interface IWebhookInboxEventRepository {
  save(event: WebhookInboxEvent): Promise<void>;

  findByConfigId(
    configId: string,
    options?: ListWebhookInboxEventsOptions,
  ): Promise<WebhookInboxEvent[]>;

  countByConfigId(configId: string): Promise<number>;
}
