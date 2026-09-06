import {
  IOperatorAuditLogRepository,
  ListOperatorAuditLogsQuery,
  OperatorAuditAction,
  OperatorAuditLog as DomainOperatorAuditLog,
  OperatorAuditState,
} from '@hockpay/core';
import {
  OperatorAuditLog as PrismaOperatorAuditLog,
  Prisma,
  PrismaClient,
} from '@hockpay/database';

/**
 * Append-only trail.
 *
 * There is no update and no delete here because the port has none: the only
 * way to change what the trail says is to append another line.
 */
export class OperatorAuditLogRepository implements IOperatorAuditLogRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async append(log: DomainOperatorAuditLog): Promise<void> {
    await this.prisma.operatorAuditLog.create({
      data: {
        id: log.id,
        operatorId: log.operatorId,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        before: (log.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        after: (log.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        reason: log.reason,
        requestId: log.requestId,
        createdAt: log.createdAt,
      },
    });
  }

  async list(query: ListOperatorAuditLogsQuery): Promise<DomainOperatorAuditLog[]> {
    const rows = await this.prisma.operatorAuditLog.findMany({
      where: query.operatorId ? { operatorId: query.operatorId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
    });

    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(log: PrismaOperatorAuditLog): DomainOperatorAuditLog {
    return DomainOperatorAuditLog.reconstitute({
      id: log.id,
      operatorId: log.operatorId,
      action: log.action as OperatorAuditAction,
      targetType: log.targetType,
      targetId: log.targetId ?? undefined,
      before: (log.before as OperatorAuditState | null) ?? undefined,
      after: (log.after as OperatorAuditState | null) ?? undefined,
      reason: log.reason ?? undefined,
      requestId: log.requestId ?? undefined,
      createdAt: log.createdAt,
    });
  }
}
