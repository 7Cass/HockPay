import { IAlertConfigRepository } from '../../domain/repositories/alert-config.repository.interface';
import { AlertConfigNotFoundError } from '../../domain/errors/alert-config-not-found.error';

export interface IDeleteAlertConfigInput {
  storeId: string;
  configId: string;
}

export class DeleteAlertConfigUseCase {
  constructor(private readonly alertConfigRepository: IAlertConfigRepository) {}

  async execute(input: IDeleteAlertConfigInput): Promise<void> {
    const alertConfig = await this.alertConfigRepository.findById(input.configId);

    if (!alertConfig || alertConfig.storeId !== input.storeId) {
      throw new AlertConfigNotFoundError(input.configId);
    }

    await this.alertConfigRepository.delete(input.configId);
  }
}
