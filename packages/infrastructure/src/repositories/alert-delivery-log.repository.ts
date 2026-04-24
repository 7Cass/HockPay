import {
  AlertChannel,
  AlertDeliveryLog,
  AlertDeliveryLogProps,
  AlertDeliveryStatus,
  IAlertDeliveryLogRepository,
} from '@hockpay/core';
import {
  AlertChannel as PrismaAlertChannel,
  AlertDeliveryStatus as PrismaAlertDeliveryStatus,
  Prisma,
  PrismaClient,
} from '@hockpay/database';

export class AlertDeliveryLogRepository implements IAlertDeliveryLogRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async save(log: AlertDeliveryLog): Promise<void> {
    await this.prisma.alertDeliveryLog.create({
      data: this.toPersistence(log),
    });
  }

  async update(log: AlertDeliveryLog): Promise<void> {
    await this.prisma.alertDeliveryLog.update({
      where: { id: log.id },
      data: {
        status: toPrismaStatus(log.status),
        responseStatus: log.responseStatus,
        responseBody: log.responseBody,
        errorMessage: log.errorMessage,
        attempt: log.attempt,
        nextRetryAt: log.nextRetryAt,
        deliveredAt: log.deliveredAt,
      },
    });
  }

  async findById(id: string): Promise<AlertDeliveryLog | null> {
    const log = await this.prisma.alertDeliveryLog.findUnique({ where: { id } });
    return log ? this.toDomain(log) : null;
  }

  async findByAlertConfigId(alertConfigId: string, limit = 50): Promise<AlertDeliveryLog[]> {
    const logs = await this.prisma.alertDeliveryLog.findMany({
      where: { alertConfigId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return logs.map((log) => this.toDomain(log));
  }

  async findByAlertConfigIdAndOutboxEventId(
    alertConfigId: string,
    outboxEventId: string,
  ): Promise<AlertDeliveryLog | null> {
    const log = await this.prisma.alertDeliveryLog.findUnique({
      where: {
        alertConfigId_outboxEventId: {
          alertConfigId,
          outboxEventId,
        },
      },
    });
    return log ? this.toDomain(log) : null;
  }

  async countByAlertConfigId(alertConfigId: string, status?: AlertDeliveryStatus): Promise<number> {
    return this.prisma.alertDeliveryLog.count({
      where: {
        alertConfigId,
        status: status ? toPrismaStatus(status) : undefined,
      },
    });
  }

  private toPersistence(log: AlertDeliveryLog): Prisma.AlertDeliveryLogUncheckedCreateInput {
    return {
      id: log.id,
      alertConfigId: log.alertConfigId,
      outboxEventId: log.outboxEventId,
      paymentId: log.paymentId,
      eventType: log.eventType,
      channel: toPrismaChannel(log.channel),
      status: toPrismaStatus(log.status),
      payload: log.payload as Prisma.InputJsonValue,
      responseStatus: log.responseStatus,
      responseBody: log.responseBody,
      errorMessage: log.errorMessage,
      attempt: log.attempt,
      maxAttempts: log.maxAttempts,
      nextRetryAt: log.nextRetryAt,
      deliveredAt: log.deliveredAt,
      createdAt: log.createdAt,
    };
  }

  private toDomain(log: {
    id: string;
    alertConfigId: string;
    outboxEventId: string;
    paymentId: string | null;
    eventType: string;
    channel: PrismaAlertChannel;
    status: PrismaAlertDeliveryStatus;
    payload: Prisma.JsonValue;
    responseStatus: number | null;
    responseBody: string | null;
    errorMessage: string | null;
    attempt: number;
    maxAttempts: number;
    nextRetryAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
  }): AlertDeliveryLog {
    const props: AlertDeliveryLogProps = {
      id: log.id,
      alertConfigId: log.alertConfigId,
      outboxEventId: log.outboxEventId,
      paymentId: log.paymentId ?? undefined,
      eventType: log.eventType,
      channel: toDomainChannel(log.channel),
      status: toDomainStatus(log.status),
      payload: log.payload as Record<string, unknown>,
      responseStatus: log.responseStatus ?? undefined,
      responseBody: log.responseBody ?? undefined,
      errorMessage: log.errorMessage ?? undefined,
      attempt: log.attempt,
      maxAttempts: log.maxAttempts,
      nextRetryAt: log.nextRetryAt ?? undefined,
      deliveredAt: log.deliveredAt ?? undefined,
      createdAt: log.createdAt,
    };
    return AlertDeliveryLog.reconstitute(props);
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

function toPrismaStatus(status: AlertDeliveryStatus): PrismaAlertDeliveryStatus {
  switch (status) {
    case AlertDeliveryStatus.PENDING:
      return PrismaAlertDeliveryStatus.PENDING;
    case AlertDeliveryStatus.DELIVERED:
      return PrismaAlertDeliveryStatus.DELIVERED;
    case AlertDeliveryStatus.FAILED:
      return PrismaAlertDeliveryStatus.FAILED;
  }
}

function toDomainStatus(status: PrismaAlertDeliveryStatus): AlertDeliveryStatus {
  switch (status) {
    case PrismaAlertDeliveryStatus.PENDING:
      return AlertDeliveryStatus.PENDING;
    case PrismaAlertDeliveryStatus.DELIVERED:
      return AlertDeliveryStatus.DELIVERED;
    case PrismaAlertDeliveryStatus.FAILED:
      return AlertDeliveryStatus.FAILED;
  }
}
