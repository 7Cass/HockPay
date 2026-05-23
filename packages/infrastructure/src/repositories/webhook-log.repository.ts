import { PrismaClient } from "@hockpay/database";
import {
  IWebhookLogRepository,
  FindWebhookLogsByConfigIdOptions,
  WebhookLogStatus,
  WebhookLog,
  WebhookDeliveryStatus,
  WebhookLogProps,
} from "@hockpay/core";
import { Prisma } from "@hockpay/database";

/**
 * Infrastructure implementation of IWebhookLogRepository.
 * Shared between API and Worker.
 */
export class WebhookLogRepository implements IWebhookLogRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async save(log: WebhookLog): Promise<void> {
    await this.prisma.webhookLog.create({
      data: this.toCreateData(log),
    });
  }

  async update(log: WebhookLog): Promise<void> {
    await this.prisma.webhookLog.update({
      where: { id: log.id },
      data: this.toUpdateData(log),
    });
  }

  async upsertDelivery(log: WebhookLog): Promise<void> {
    if (!log.outboxEventId) {
      await this.save(log);
      return;
    }

    await this.prisma.webhookLog.upsert({
      where: {
        configId_outboxEventId: {
          configId: log.configId,
          outboxEventId: log.outboxEventId,
        },
      } as any,
      create: this.toCreateData(log),
      update: this.toUpdateData(log),
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

  async findByConfigAndOutboxEvent(
    configId: string,
    outboxEventId: string,
  ): Promise<WebhookLog | null> {
    const prismaLog = await this.prisma.webhookLog.findFirst({
      where: {
        configId,
        outboxEventId,
      },
    });

    if (!prismaLog) {
      return null;
    }

    return this.toDomain(prismaLog);
  }

  async findByOutboxEventId(outboxEventId: string): Promise<WebhookLog[]> {
    const logs = await this.prisma.webhookLog.findMany({
      where: { outboxEventId },
      orderBy: { createdAt: "asc" },
    });

    return logs.map((l) => this.toDomain(l));
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
        status: WebhookDeliveryStatus.FAILED_RETRYABLE as any,
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

  async markOutboxDeliveriesFinalFailure(
    outboxEventId: string,
    error: string,
    attemptsMade?: number,
  ): Promise<number> {
    const result = await this.prisma.webhookLog.updateMany({
      where: {
        outboxEventId,
        status: { not: WebhookDeliveryStatus.DELIVERED as any },
      },
      data: {
        status: WebhookDeliveryStatus.FAILED_FINAL as any,
        ...(attemptsMade !== undefined ? { attempt: attemptsMade } : {}),
        nextRetryAt: null,
        failedAt: new Date(),
        lastError: error,
      },
    });

    return result.count;
  }

  async resetOutboxDeliveriesForRequeue(
    outboxEventId: string,
    configIds?: string[],
  ): Promise<number> {
    const result = await this.prisma.webhookLog.updateMany({
      where: {
        outboxEventId,
        status: { not: WebhookDeliveryStatus.DELIVERED as any },
        ...(configIds && configIds.length > 0
          ? { configId: { in: configIds } }
          : {}),
      },
      data: {
        status: WebhookDeliveryStatus.PENDING as any,
        attempt: 0,
        nextRetryAt: null,
        failedAt: null,
        lastError: null,
        responseStatus: null,
        responseBody: null,
      },
    });

    return result.count;
  }

  private buildConfigStatusWhere(configId: string, status?: WebhookLogStatus) {
    switch (status) {
      case "delivered":
        return {
          configId,
          status: WebhookDeliveryStatus.DELIVERED,
        };
      case "failed":
        return {
          configId,
          status: {
            in: [
              WebhookDeliveryStatus.FAILED_RETRYABLE,
              WebhookDeliveryStatus.FAILED_FINAL,
            ],
          },
        };
      case "pending":
        return {
          configId,
          status: WebhookDeliveryStatus.PENDING,
        };
      default:
        return { configId };
    }
  }

  private toCreateData(log: WebhookLog) {
    return {
      id: log.id,
      configId: log.configId,
      paymentId: log.paymentId,
      aggregateType: log.aggregateType,
      aggregateId: log.aggregateId,
      outboxEventId: log.outboxEventId,
      requestId: log.requestId,
      eventType: log.eventType,
      payload: log.payload as any,
      requestHeaders: log.requestHeaders as any,
      responseStatus: log.responseStatus,
      responseBody: log.responseBody,
      status: log.status as any,
      attempt: log.attempt,
      maxAttempts: log.maxAttempts,
      nextRetryAt: log.nextRetryAt,
      deliveredAt: log.deliveredAt,
      failedAt: log.failedAt,
      lastError: log.lastError,
      createdAt: log.createdAt,
    } as any;
  }

  private toUpdateData(log: WebhookLog) {
    return {
      requestId: log.requestId,
      aggregateType: log.aggregateType,
      aggregateId: log.aggregateId,
      requestHeaders: log.requestHeaders as any,
      responseStatus: log.responseStatus,
      responseBody: log.responseBody,
      status: log.status as any,
      attempt: log.attempt,
      maxAttempts: log.maxAttempts,
      nextRetryAt: log.nextRetryAt,
      deliveredAt: log.deliveredAt,
      failedAt: log.failedAt,
      lastError: log.lastError,
    } as any;
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
    status?: string | null;
    attempt: number;
    maxAttempts: number;
    nextRetryAt: Date | null;
    deliveredAt: Date | null;
    failedAt?: Date | null;
    lastError?: string | null;
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
      status: prismaLog.status as WebhookDeliveryStatus | undefined,
      attempt: prismaLog.attempt,
      maxAttempts: prismaLog.maxAttempts,
      nextRetryAt: prismaLog.nextRetryAt ?? undefined,
      deliveredAt: prismaLog.deliveredAt ?? undefined,
      failedAt: prismaLog.failedAt ?? undefined,
      lastError: prismaLog.lastError ?? undefined,
      createdAt: prismaLog.createdAt,
    } as any;

    return WebhookLog.reconstitute(props);
  }
}
