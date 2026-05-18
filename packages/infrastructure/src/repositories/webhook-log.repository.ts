import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@hockpay/database";
import {
  IWebhookLogRepository,
  FindWebhookLogsByConfigIdOptions,
  WebhookLogStatus,
  WebhookLog,
  WebhookLogProps,
} from "@hockpay/core";

/**
 * Infrastructure implementation of IWebhookLogRepository.
 * Shared between API and Worker.
 */
@Injectable()
export class WebhookLogRepository implements IWebhookLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(log: WebhookLog): Promise<void> {
    await this.prisma.webhookLog.create({
      data: {
        id: log.id,
        configId: log.configId,
        paymentId: log.paymentId,
        aggregateType: (log as any).aggregateType,
        aggregateId: (log as any).aggregateId,
        outboxEventId: log.outboxEventId,
        requestId: log.requestId,
        eventType: log.eventType,
        payload: log.payload as any,
        requestHeaders: log.requestHeaders as any,
        responseStatus: log.responseStatus,
        responseBody: log.responseBody,
        attempt: log.attempt,
        maxAttempts: log.maxAttempts,
        nextRetryAt: log.nextRetryAt,
        deliveredAt: log.deliveredAt,
        createdAt: log.createdAt,
      } as any,
    });
  }

  async update(log: WebhookLog): Promise<void> {
    await this.prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        requestId: log.requestId,
        aggregateType: (log as any).aggregateType,
        aggregateId: (log as any).aggregateId,
        requestHeaders: log.requestHeaders as any,
        responseStatus: log.responseStatus,
        responseBody: log.responseBody,
        attempt: log.attempt,
        nextRetryAt: log.nextRetryAt,
        deliveredAt: log.deliveredAt,
      } as any,
    });
  }

  async findById(id: string): Promise<WebhookLog | null> {
    const prismaLog = await this.prisma.webhookLog.findUnique({
      where: { id },
    });

    if (!prismaLog) {
      return null;
    }

    return this.toDomain(prismaLog);
  }

  async findByConfigId(
    configId: string,
    options: FindWebhookLogsByConfigIdOptions = {},
  ): Promise<WebhookLog[]> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 50;
    const logs = await this.prisma.webhookLog.findMany({
      where: this.buildConfigStatusWhere(configId, options.status),
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return logs.map((l) => this.toDomain(l));
  }

  async findByPaymentId(paymentId: string): Promise<WebhookLog[]> {
    const logs = await this.prisma.webhookLog.findMany({
      where: { paymentId },
      orderBy: { createdAt: "desc" },
    });

    return logs.map((l) => this.toDomain(l));
  }

  async findFailedPendingRetry(limit: number): Promise<WebhookLog[]> {
    const logs = await this.prisma.webhookLog.findMany({
      where: {
        deliveredAt: null,
        nextRetryAt: { lte: new Date() },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return logs.map((l) => this.toDomain(l));
  }

  async deleteOldLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.webhookLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  async countByConfigId(
    configId: string,
    status?: WebhookLogStatus,
  ): Promise<number> {
    return this.prisma.webhookLog.count({
      where: this.buildConfigStatusWhere(configId, status),
    });
  }

  private buildConfigStatusWhere(configId: string, status?: WebhookLogStatus) {
    switch (status) {
      case "delivered":
        return {
          configId,
          deliveredAt: { not: null },
        };
      case "failed":
        return {
          configId,
          deliveredAt: null,
          attempt: { gt: 1 },
        };
      case "pending":
        return {
          configId,
          deliveredAt: null,
          attempt: 1,
        };
      default:
        return { configId };
    }
  }

  private toDomain(prismaLog: {
    id: string;
    configId: string;
    paymentId: string | null;
    aggregateType?: string | null;
    aggregateId?: string | null;
    outboxEventId: string | null;
    requestId: string | null;
    eventType: string;
    payload: any;
    requestHeaders: any;
    responseStatus: number | null;
    responseBody: string | null;
    attempt: number;
    maxAttempts: number;
    nextRetryAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
  }): WebhookLog {
    const props: WebhookLogProps = {
      id: prismaLog.id,
      configId: prismaLog.configId,
      paymentId: prismaLog.paymentId ?? undefined,
      aggregateType: prismaLog.aggregateType ?? undefined,
      aggregateId: prismaLog.aggregateId ?? undefined,
      outboxEventId: prismaLog.outboxEventId ?? undefined,
      requestId: prismaLog.requestId ?? undefined,
      eventType: prismaLog.eventType,
      payload: prismaLog.payload as Record<string, unknown>,
      requestHeaders: prismaLog.requestHeaders as
        | Record<string, string>
        | undefined,
      responseStatus: prismaLog.responseStatus ?? undefined,
      responseBody: prismaLog.responseBody ?? undefined,
      attempt: prismaLog.attempt,
      maxAttempts: prismaLog.maxAttempts,
      nextRetryAt: prismaLog.nextRetryAt ?? undefined,
      deliveredAt: prismaLog.deliveredAt ?? undefined,
      createdAt: prismaLog.createdAt,
    } as any;

    return WebhookLog.reconstitute(props);
  }
}
