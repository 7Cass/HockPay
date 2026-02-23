import {
  IWebhookLogRepository,
  IWebhookConfigRepository,
  WebhookLog,
  WebhookConfigNotFoundError,
} from '../..';

/**
 * Input for listing webhook logs.
 */
export interface IListWebhookLogsInput {
  storeId: string;
  configId?: string;
  page?: number;
  limit?: number;
  status?: 'pending' | 'delivered' | 'failed';
}

/**
 * Output of listing webhook logs.
 */
export interface IListWebhookLogsOutput {
  logs: WebhookLog[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Use case for listing webhook delivery logs.
 */
export class ListWebhookLogsUseCase {
  constructor(
    private readonly webhookLogRepository: IWebhookLogRepository,
    private readonly webhookConfigRepository: IWebhookConfigRepository,
  ) {}

  async execute(input: IListWebhookLogsInput): Promise<IListWebhookLogsOutput> {
    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? 50, 100);

    // If configId is provided, validate ownership
    if (input.configId) {
      const config = await this.webhookConfigRepository.findById(input.configId);
      if (!config || config.storeId !== input.storeId) {
        throw new WebhookConfigNotFoundError(input.configId);
      }

      const logs = await this.webhookLogRepository.findByConfigId(input.configId, limit);
      const filteredLogs = this.filterByStatus(logs, input.status);

      return {
        logs: filteredLogs,
        total: filteredLogs.length,
        page,
        limit,
      };
    }

    // If no configId, get all configs for the store and their logs
    const configs = await this.webhookConfigRepository.findByStoreId(input.storeId);
    const allLogs: WebhookLog[] = [];

    for (const config of configs) {
      const logs = await this.webhookLogRepository.findByConfigId(config.id, limit);
      allLogs.push(...logs);
    }

    // Sort by createdAt descending
    allLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const filteredLogs = this.filterByStatus(allLogs, input.status);
    const paginatedLogs = filteredLogs.slice((page - 1) * limit, page * limit);

    return {
      logs: paginatedLogs,
      total: filteredLogs.length,
      page,
      limit,
    };
  }

  private filterByStatus(logs: WebhookLog[], status?: 'pending' | 'delivered' | 'failed'): WebhookLog[] {
    if (!status) return logs;

    switch (status) {
      case 'delivered':
        return logs.filter((log) => log.isDelivered());
      case 'failed':
        return logs.filter((log) => !log.isDelivered() && log.attempt > 0);
      case 'pending':
        return logs.filter((log) => !log.isDelivered() && log.attempt === 1);
      default:
        return logs;
    }
  }
}
