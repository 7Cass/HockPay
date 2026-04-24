import { AlertConfig } from '../../domain/entities/alert-config.entity';
import { IAlertConfigRepository } from '../../domain/repositories/alert-config.repository.interface';
import { AlertConfigNotFoundError } from '../../domain/errors/alert-config-not-found.error';

export interface IGetAlertConfigInput {
  storeId: string;
  configId: string;
}

export interface IGetAlertConfigOutput {
  alertConfig: AlertConfig;
}

export class GetAlertConfigUseCase {
  constructor(private readonly alertConfigRepository: IAlertConfigRepository) {}

  async execute(input: IGetAlertConfigInput): Promise<IGetAlertConfigOutput> {
    const alertConfig = await this.alertConfigRepository.findById(input.configId);

    if (!alertConfig || alertConfig.storeId !== input.storeId) {
      throw new AlertConfigNotFoundError(input.configId);
    }

    return { alertConfig };
  }
}
