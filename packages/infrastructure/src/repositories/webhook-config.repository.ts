import { PrismaClient } from '@hockpay/database';
import { IWebhookConfigRepository, WebhookConfig, WebhookConfigProps } from '@hockpay/core';

/**
 * Infrastructure implementation of IWebhookConfigRepository.
 * Shared between API and Worker.
 */
export class WebhookConfigRepository implements IWebhookConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(config: WebhookConfig): Promise<void> {
    await this.prisma.webhookConfig.create({
      data: {
        id: config.id,
        storeId: config.storeId,
        url: config.url,
        secret: config.secret,
        prefix: config.prefix,
        events: config.events,
        isActive: config.isActive,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  }

  async update(config: WebhookConfig): Promise<void> {
    await this.prisma.webhookConfig.update({
      where: { id: config.id },
      data: {
        url: config.url,
        events: config.events,
        isActive: config.isActive,
        updatedAt: config.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<WebhookConfig | null> {
    const prismaConfig = await this.prisma.webhookConfig.findUnique({
      where: { id },
    });

    if (!prismaConfig) {
      return null;
    }

    return this.toDomain(prismaConfig);
  }

  async findByStoreId(storeId: string): Promise<WebhookConfig[]> {
    const configs = await this.prisma.webhookConfig.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });

    return configs.map((c) => this.toDomain(c));
  }

  async findActiveForEvent(storeId: string, eventType: string): Promise<WebhookConfig[]> {
    const configs = await this.prisma.webhookConfig.findMany({
      where: {
        storeId,
        isActive: true,
        events: { has: eventType },
      },
    });

    return configs.map((c) => this.toDomain(c));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.webhookConfig.delete({
      where: { id },
    });
  }

  private toDomain(prismaConfig: {
    id: string;
    storeId: string;
    url: string;
    secret: string;
    prefix: string;
    events: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): WebhookConfig {
    const props: WebhookConfigProps = {
      id: prismaConfig.id,
      storeId: prismaConfig.storeId,
      url: prismaConfig.url,
      secret: prismaConfig.secret,
      prefix: prismaConfig.prefix,
      events: prismaConfig.events,
      isActive: prismaConfig.isActive,
      createdAt: prismaConfig.createdAt,
      updatedAt: prismaConfig.updatedAt,
    };

    return WebhookConfig.reconstitute(props);
  }
}
