import { AlertConfig, AlertConfigObject, AlertChannel } from '../../domain/entities/alert-config.entity';
import { IAlertConfigRepository } from '../../domain/repositories/alert-config.repository.interface';
import { IEncryptionPort } from '../ports/encryption.port';
import { buildDiscordAlertConfig, validateAlertChannel, validateAlertEvents } from './alert-config.helpers';

export interface ICreateAlertConfigInput {
  storeId: string;
  name: string;
  channel: string;
  discord: {
    webhookUrl: string;
  };
  events: string[];
  isActive?: boolean;
}

export interface ICreateAlertConfigOutput {
  alertConfig: AlertConfigObject;
}

export class CreateAlertConfigUseCase {
  constructor(
    private readonly alertConfigRepository: IAlertConfigRepository,
    private readonly encryption: IEncryptionPort,
  ) {}

  async execute(input: ICreateAlertConfigInput): Promise<ICreateAlertConfigOutput> {
    validateAlertChannel(input.channel);
    validateAlertEvents(input.events);

    const { encryptedConfig, configPreview } = buildDiscordAlertConfig(
      input.discord.webhookUrl,
      this.encryption,
    );

    const alertConfig = AlertConfig.create({
      storeId: input.storeId,
      name: input.name.trim(),
      channel: input.channel as AlertChannel,
      encryptedConfig,
      configPreview,
      events: input.events,
      isActive: input.isActive,
    });

    await this.alertConfigRepository.save(alertConfig);

    return { alertConfig: alertConfig.toObject() };
  }
}
