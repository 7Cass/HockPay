import { AlertConfig } from '../../domain/entities/alert-config.entity';
import { IAlertConfigRepository } from '../../domain/repositories/alert-config.repository.interface';
import { AlertConfigNotFoundError } from '../../domain/errors/alert-config-not-found.error';
import { IEncryptionPort } from '../ports/encryption.port';
import { buildDiscordAlertConfig, validateAlertEvents } from './alert-config.helpers';

export interface IUpdateAlertConfigInput {
  storeId: string;
  configId: string;
  name?: string;
  discord?: {
    webhookUrl?: string;
  };
  events?: string[];
  isActive?: boolean;
}

export interface IUpdateAlertConfigOutput {
  alertConfig: AlertConfig;
}

export class UpdateAlertConfigUseCase {
  constructor(
    private readonly alertConfigRepository: IAlertConfigRepository,
    private readonly encryption: IEncryptionPort,
  ) {}

  async execute(input: IUpdateAlertConfigInput): Promise<IUpdateAlertConfigOutput> {
    const alertConfig = await this.alertConfigRepository.findById(input.configId);

    if (!alertConfig || alertConfig.storeId !== input.storeId) {
      throw new AlertConfigNotFoundError(input.configId);
    }

    if (input.events !== undefined) {
      validateAlertEvents(input.events);
    }

    const nextConfig = input.discord?.webhookUrl
      ? buildDiscordAlertConfig(input.discord.webhookUrl, this.encryption)
      : undefined;

    alertConfig.update({
      name: input.name?.trim(),
      events: input.events,
      isActive: input.isActive,
      encryptedConfig: nextConfig?.encryptedConfig,
      configPreview: nextConfig?.configPreview,
    });

    await this.alertConfigRepository.update(alertConfig);

    return { alertConfig };
  }
}
