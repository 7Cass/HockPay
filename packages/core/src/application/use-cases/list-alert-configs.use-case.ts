import { AlertConfig } from '../../domain/entities/alert-config.entity';
import { IAlertConfigRepository } from '../../domain/repositories/alert-config.repository.interface';

export interface IListAlertConfigsInput {
  storeId: string;
}

export interface IListAlertConfigsOutput {
  alertConfigs: AlertConfig[];
}

export class ListAlertConfigsUseCase {
  constructor(private readonly alertConfigRepository: IAlertConfigRepository) {}

  async execute(input: IListAlertConfigsInput): Promise<IListAlertConfigsOutput> {
    return {
      alertConfigs: await this.alertConfigRepository.findByStoreId(input.storeId),
    };
  }
}
