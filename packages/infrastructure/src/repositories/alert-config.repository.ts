import {
  AlertChannel,
  AlertConfig,
  AlertConfigPreview,
  AlertEncryptedConfig,
  AlertConfigProps,
  IAlertConfigRepository,
} from '@hockpay/core';
import { AlertChannel as PrismaAlertChannel, Prisma, PrismaClient } from '@hockpay/database';

export class AlertConfigRepository implements IAlertConfigRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async save(config: AlertConfig): Promise<void> {
    await this.prisma.alertConfig.create({
      data: {
        id: config.id,
        storeId: config.storeId,
        name: config.name,
        channel: toPrismaChannel(config.channel),
        encryptedConfig: config.encryptedConfig as unknown as Prisma.InputJsonValue,
        configPreview: config.configPreview as unknown as Prisma.InputJsonValue,
        events: config.events,
        isActive: config.isActive,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  }

  async update(config: AlertConfig): Promise<void> {
    await this.prisma.alertConfig.update({
      where: { id: config.id },
      data: {
        name: config.name,
        encryptedConfig: config.encryptedConfig as unknown as Prisma.InputJsonValue,
        configPreview: config.configPreview as unknown as Prisma.InputJsonValue,
        events: config.events,
        isActive: config.isActive,
        updatedAt: config.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<AlertConfig | null> {
    const config = await this.prisma.alertConfig.findUnique({ where: { id } });
    return config ? this.toDomain(config) : null;
  }

  async findByStoreId(storeId: string): Promise<AlertConfig[]> {
    const configs = await this.prisma.alertConfig.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
    return configs.map((config) => this.toDomain(config));
  }

  async findActiveForEvent(storeId: string, eventType: string): Promise<AlertConfig[]> {
    const configs = await this.prisma.alertConfig.findMany({
      where: {
        storeId,
        isActive: true,
        events: { has: eventType },
      },
      orderBy: { createdAt: 'asc' },
    });
    return configs.map((config) => this.toDomain(config));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.alertConfig.delete({ where: { id } });
  }

  private toDomain(config: {
    id: string;
    storeId: string;
    name: string;
    channel: PrismaAlertChannel;
    encryptedConfig: Prisma.JsonValue;
    configPreview: Prisma.JsonValue;
    events: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AlertConfig {
    const props: AlertConfigProps = {
      id: config.id,
      storeId: config.storeId,
      name: config.name,
      channel: toDomainChannel(config.channel),
      encryptedConfig: config.encryptedConfig as unknown as AlertEncryptedConfig,
      configPreview: config.configPreview as unknown as AlertConfigPreview,
      events: config.events,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
    return AlertConfig.reconstitute(props);
  }
}

function toPrismaChannel(channel: AlertChannel): PrismaAlertChannel {
  switch (channel) {
    case 'discord':
      return PrismaAlertChannel.DISCORD;
  }
}

function toDomainChannel(channel: PrismaAlertChannel): AlertChannel {
  switch (channel) {
    case PrismaAlertChannel.DISCORD:
      return 'discord';
  }
}
