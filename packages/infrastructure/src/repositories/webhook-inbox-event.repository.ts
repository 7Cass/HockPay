import { PrismaClient } from '@hockpay/database';
import {
  IWebhookInboxEventRepository,
  ListWebhookInboxEventsOptions,
  WebhookInboxEvent,
  WebhookInboxEventProps,
} from '@hockpay/core';

export class WebhookInboxEventRepository implements IWebhookInboxEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(event: WebhookInboxEvent): Promise<void> {
    await this.prisma.webhookInboxEvent.create({
      data: {
        id: event.id,
        storeId: event.storeId,
        configId: event.configId,
        eventType: event.eventType,
        payload: event.payload as any,
        requestHeaders: event.requestHeaders as any,
        requestId: event.requestId,
        deliveryId: event.deliveryId,
        outboxEventId: event.outboxEventId,
        paymentId: event.paymentId,
        signatureValid: event.signatureValid,
        receivedAt: event.receivedAt,
      },
    });
  }

  async findByConfigId(
    configId: string,
    options: ListWebhookInboxEventsOptions = {},
  ): Promise<WebhookInboxEvent[]> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 50;
    const events = await this.prisma.webhookInboxEvent.findMany({
      where: { configId },
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return events.map((event: any) => this.toDomain(event));
  }

  async countByConfigId(configId: string): Promise<number> {
    return this.prisma.webhookInboxEvent.count({
      where: { configId },
    });
  }

  private toDomain(prismaEvent: {
    id: string;
    storeId: string;
    configId: string;
    eventType: string;
    payload: any;
    requestHeaders: any;
    requestId: string | null;
    deliveryId: string | null;
    outboxEventId: string | null;
    paymentId: string | null;
    signatureValid: boolean;
    receivedAt: Date;
  }): WebhookInboxEvent {
    const props: WebhookInboxEventProps = {
      id: prismaEvent.id,
      storeId: prismaEvent.storeId,
      configId: prismaEvent.configId,
      eventType: prismaEvent.eventType,
      payload: prismaEvent.payload as Record<string, unknown>,
      requestHeaders: prismaEvent.requestHeaders as Record<string, string> | undefined,
      requestId: prismaEvent.requestId ?? undefined,
      deliveryId: prismaEvent.deliveryId ?? undefined,
      outboxEventId: prismaEvent.outboxEventId ?? undefined,
      paymentId: prismaEvent.paymentId ?? undefined,
      signatureValid: prismaEvent.signatureValid,
      receivedAt: prismaEvent.receivedAt,
    };

    return WebhookInboxEvent.reconstitute(props);
  }
}
