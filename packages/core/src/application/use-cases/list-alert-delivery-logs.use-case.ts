import { AlertDeliveryLog, AlertDeliveryStatus } from '../../domain/entities/alert-delivery-log.entity';
import { IAlertConfigRepository } from '../../domain/repositories/alert-config.repository.interface';
import { IAlertDeliveryLogRepository } from '../../domain/repositories/alert-delivery-log.repository.interface';
import { AlertConfigNotFoundError } from '../../domain/errors/alert-config-not-found.error';

export interface IListAlertDeliveryLogsInput {
  storeId: string;
  configId: string;
  page?: number;
  limit?: number;
  status?: AlertDeliveryStatus;
}

export interface IListAlertDeliveryLogsOutput {
  logs: AlertDeliveryLog[];
  total: number;
  page: number;
  limit: number;
}

export class ListAlertDeliveryLogsUseCase {
  constructor(
    private readonly alertLogRepository: IAlertDeliveryLogRepository,
    private readonly alertConfigRepository: IAlertConfigRepository,
  ) {}

  async execute(input: IListAlertDeliveryLogsInput): Promise<IListAlertDeliveryLogsOutput> {
    const alertConfig = await this.alertConfigRepository.findById(input.configId);

    if (!alertConfig || alertConfig.storeId !== input.storeId) {
      throw new AlertConfigNotFoundError(input.configId);
    }

    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? 50, 100);
    const allLogs = await this.alertLogRepository.findByAlertConfigId(input.configId, page * limit);
    const filteredLogs = input.status
      ? allLogs.filter((log) => log.status === input.status)
      : allLogs;

    return {
      logs: filteredLogs.slice((page - 1) * limit, page * limit),
      total: await this.alertLogRepository.countByAlertConfigId(input.configId, input.status),
      page,
      limit,
    };
  }
}
