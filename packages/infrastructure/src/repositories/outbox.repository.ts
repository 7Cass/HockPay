import {
  ClaimDispatchableEventsParams,
  IOutboxRepository,
  OutboxEvent,
  OutboxEventProps,
  OutboxEventStatus,
} from "@hockpay/core";
import { PrismaClient, OutboxStatus, Prisma } from "@hockpay/database";

type OutboxEventRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  requestId: string | null;
  payload: unknown;
  status: OutboxStatus;
  processedAt: Date | null;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
};

/**
 * Shared implementation of IOutboxRepository using Prisma.
 *
 * This repository can be used by both API and Worker apps.
 * Each app provides its own PrismaClient instance.
 */
export class OutboxRepository implements IOutboxRepository {
  private static readonly LEGACY_DISPATCHED_STALE_MS = 45 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async save(event: OutboxEvent): Promise<void> {
    await this.prisma.outboxEvent.create({
      data: {
        id: event.id,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        requestId: event.requestId,
        payload: event.payload as any,
        status: event.status as OutboxStatus,
        processedAt: event.processedAt,
        retryCount: event.retryCount,
        maxRetries: event.maxRetries,
        nextRetryAt: event.nextRetryAt,
        errorMessage: event.errorMessage,
        createdAt: event.createdAt,
      },
    });
  }

  async update(event: OutboxEvent): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: event.status as OutboxStatus,
        processedAt: event.processedAt,
        retryCount: event.retryCount,
        nextRetryAt: event.nextRetryAt,
        errorMessage: event.errorMessage,
      },
    });
  }

  async resetForRequeue(id: string, watchdogUntil: Date): Promise<number> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id },
      data: {
        status: OutboxStatus.DISPATCHED,
        processedAt: null,
        retryCount: 0,
        nextRetryAt: watchdogUntil,
        errorMessage: null,
      },
    });

    return result.count;
  }

  async findById(id: string): Promise<OutboxEvent | null> {
    const prismaEvent = await this.prisma.outboxEvent.findUnique({
      where: { id },
    });

    if (!prismaEvent) {
      return null;
    }

    return this.toDomain(prismaEvent);
  }

  async findPendingEvents(limit: number): Promise<OutboxEvent[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: OutboxStatus.PENDING,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return events.map((e) => this.toDomain(e));
  }

  async findDispatchableEvents(
    limit: number,
    now = new Date(),
  ): Promise<OutboxEvent[]> {
    const legacyDispatchedCutoff = new Date(
      now.getTime() - OutboxRepository.LEGACY_DISPATCHED_STALE_MS,
    );

    const events = await this.prisma.outboxEvent.findMany({
      where: {
        OR: [
          {
            status: OutboxStatus.PENDING,
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          {
            status: OutboxStatus.FAILED,
            retryCount: { lt: this.prisma.outboxEvent.fields.maxRetries },
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          {
            status: OutboxStatus.DISPATCHED,
            processedAt: null,
            nextRetryAt: { lte: now },
          },
          {
            status: OutboxStatus.DISPATCHED,
            processedAt: null,
            nextRetryAt: null,
            createdAt: { lte: legacyDispatchedCutoff },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return events.map((e) => this.toDomain(e));
  }

  async claimDispatchableEvents({
    limit,
    now = new Date(),
    watchdogUntil,
  }: ClaimDispatchableEventsParams): Promise<OutboxEvent[]> {
    if (limit <= 0) {
      return [];
    }

    const legacyDispatchedCutoff = new Date(
      now.getTime() - OutboxRepository.LEGACY_DISPATCHED_STALE_MS,
    );

    const events = await this.prisma.$queryRaw<OutboxEventRow[]>(Prisma.sql`
      WITH claimable AS (
        SELECT "id"
        FROM "outbox_events"
        WHERE (
          (
            "status" = ${OutboxStatus.PENDING}::"OutboxStatus"
            AND ("next_retry_at" IS NULL OR "next_retry_at" <= ${now})
          )
          OR (
            "status" = ${OutboxStatus.FAILED}::"OutboxStatus"
            AND "retry_count" < "max_retries"
            AND ("next_retry_at" IS NULL OR "next_retry_at" <= ${now})
          )
          OR (
            "status" = ${OutboxStatus.DISPATCHED}::"OutboxStatus"
            AND "processed_at" IS NULL
            AND "next_retry_at" <= ${now}
          )
          OR (
            "status" = ${OutboxStatus.DISPATCHED}::"OutboxStatus"
            AND "processed_at" IS NULL
            AND "next_retry_at" IS NULL
            AND "created_at" <= ${legacyDispatchedCutoff}
          )
        )
        ORDER BY "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "outbox_events" AS oe
      SET
        "status" = ${OutboxStatus.DISPATCHED}::"OutboxStatus",
        "next_retry_at" = ${watchdogUntil},
        "error_message" = NULL
      FROM claimable
      WHERE oe."id" = claimable."id"
      RETURNING
        oe."id",
        oe."aggregate_type" AS "aggregateType",
        oe."aggregate_id" AS "aggregateId",
        oe."event_type" AS "eventType",
        oe."request_id" AS "requestId",
        oe."payload",
        oe."status",
        oe."processed_at" AS "processedAt",
        oe."retry_count" AS "retryCount",
        oe."max_retries" AS "maxRetries",
        oe."next_retry_at" AS "nextRetryAt",
        oe."error_message" AS "errorMessage",
        oe."created_at" AS "createdAt"
    `);

    return events.map((e) => this.toDomain(e));
  }

  async findByAggregate(
    aggregateType: string,
    aggregateId: string,
  ): Promise<OutboxEvent[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        aggregateType,
        aggregateId,
      },
      orderBy: { createdAt: "desc" },
    });

    return events.map((e) => this.toDomain(e));
  }

  async countByStatus(status: OutboxEventStatus): Promise<number> {
    return this.prisma.outboxEvent.count({
      where: { status: status as OutboxStatus },
    });
  }

  async deleteOldProcessed(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.outboxEvent.deleteMany({
      where: {
        status: OutboxStatus.PROCESSED,
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  private toDomain(prismaEvent: any): OutboxEvent {
    const props: OutboxEventProps = {
      id: prismaEvent.id,
      aggregateType: prismaEvent.aggregateType,
      aggregateId: prismaEvent.aggregateId,
      eventType: prismaEvent.eventType,
      requestId: prismaEvent.requestId ?? undefined,
      payload: prismaEvent.payload as Record<string, unknown>,
      status: prismaEvent.status as OutboxEventStatus,
      processedAt: prismaEvent.processedAt ?? undefined,
      retryCount: prismaEvent.retryCount,
      maxRetries: prismaEvent.maxRetries,
      nextRetryAt: prismaEvent.nextRetryAt ?? undefined,
      errorMessage: prismaEvent.errorMessage ?? undefined,
      createdAt: prismaEvent.createdAt,
    };

    return OutboxEvent.reconstitute(props);
  }
}
