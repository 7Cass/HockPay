import {
  IWebhookConfigRepository,
  IWebhookInboxEventRepository,
  WebhookConfigNotFoundError,
  WebhookInboxEvent,
} from '../..';

export interface IListWebhookInboxEventsInput {
  storeId: string;
  configId: string;
  page?: number;
  limit?: number;
}

export interface IListWebhookInboxEventsOutput {
  events: WebhookInboxEvent[];
  total: number;
  page: number;
  limit: number;
}

export class ListWebhookInboxEventsUseCase {
  constructor(
    private readonly webhookInboxEventRepository: IWebhookInboxEventRepository,
    private readonly webhookConfigRepository: IWebhookConfigRepository,
  ) {}

  async execute(input: IListWebhookInboxEventsInput): Promise<IListWebhookInboxEventsOutput> {
    const config = await this.webhookConfigRepository.findById(input.configId);
    if (!config || config.storeId !== input.storeId) {
      throw new WebhookConfigNotFoundError(input.configId);
    }

    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? 50, 100);
    const [events, total] = await Promise.all([
      this.webhookInboxEventRepository.findByConfigId(input.configId, {
        page,
        limit,
      }),
      this.webhookInboxEventRepository.countByConfigId(input.configId),
    ]);

    return { events, total, page, limit };
  }
}
