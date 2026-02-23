import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  IWebhookConfigRepository,
  WebhookConfig,
  WebhookConfigProps,
} from '@hockpay/core';

/**
 * Infrastructure implementation of IWebhookConfigRepository.
 */
@Injectable()
export class WebhookConfigRepository implements IWebhookConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(config: WebhookConfig): Promise<void> {
    await this.prisma.webhookConfig.create({
      data: {
        id: config.id,
        storeId: config.storeId,
        url: config.url,
        secret: config.secret,
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

  async findActiveForEvent(
    storeId: string,
    eventType: string,
  ): Promise<WebhookConfig[]> {
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

  private toDomain(prismaConfig: any): WebhookConfig {
    const props: WebhookConfigProps = {
      id: prismaConfig.id,
      storeId: prismaConfig.storeId,
      url: prismaConfig.url,
      secret: prismaConfig.secret,
      events: prismaConfig.events,
      isActive: prismaConfig.isActive,
      createdAt: prismaConfig.createdAt,
      updatedAt: prismaConfig.updatedAt,
    };

    return WebhookConfig.reconstitute(props);
  }
}
