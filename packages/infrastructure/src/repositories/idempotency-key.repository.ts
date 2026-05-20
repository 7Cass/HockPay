import {
  IIdempotencyKeyRepository,
  IdempotencyKey,
  IdempotencyKeyProps,
  IdempotencyKeyStatus,
  IdempotencyReservation,
  IdempotencyReservationStatus,
  ReserveIdempotencyKeyProps,
} from '@hockpay/core';
import {
  IdempotencyKeyStatus as PrismaIdempotencyKeyStatus,
  Prisma,
  PrismaClient,
} from '@hockpay/database';

/**
 * Shared implementation of IIdempotencyKeyRepository using Prisma.
 *
 * This repository can be used by both API and Worker apps.
 * Each app provides its own PrismaClient instance.
 */
export class IdempotencyKeyRepository implements IIdempotencyKeyRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async findByKeyAndStore(
    key: string,
    storeId: string,
  ): Promise<IdempotencyKey | null> {
    const record = await this.prisma.idempotencyKey.findUnique({
      where: {
        key_storeId: {
          key,
          storeId,
        },
      },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findCompleted(
    key: string,
    storeId: string,
  ): Promise<IdempotencyKey | null> {
    const record = await this.findByKeyAndStore(key, storeId);

    if (!record || record.isExpired() || !record.isCompleted()) {
      return null;
    }

    return record;
  }

  async save(idempotencyKey: IdempotencyKey): Promise<void> {
    const props = idempotencyKey.toObject();

    await this.prisma.idempotencyKey.create({
      data: {
        id: props.id,
        key: props.key,
        storeId: props.storeId,
        requestMethod: props.requestMethod,
        requestPath: props.requestPath,
        requestHash: props.requestHash,
        responseBody: props.responseBody as any,
        responseStatus: props.responseStatus,
        status: props.status as unknown as PrismaIdempotencyKeyStatus,
        completedAt: props.completedAt,
        createdAt: props.createdAt,
        expiresAt: props.expiresAt,
      },
    });
  }

  async reserve(
    input: ReserveIdempotencyKeyProps,
  ): Promise<IdempotencyReservation> {
    await this.deleteExpiredForKey(input.key, input.storeId);

    const idempotencyKey = IdempotencyKey.reserve(input);
    const props = idempotencyKey.toObject();
    const result = await this.prisma.idempotencyKey.createMany({
      data: {
        id: props.id,
        key: props.key,
        storeId: props.storeId,
        requestMethod: props.requestMethod,
        requestPath: props.requestPath,
        requestHash: props.requestHash,
        responseBody: props.responseBody as any,
        responseStatus: props.responseStatus,
        status: props.status as unknown as PrismaIdempotencyKeyStatus,
        completedAt: props.completedAt,
        createdAt: props.createdAt,
        expiresAt: props.expiresAt,
      },
      skipDuplicates: true,
    });

    if (result.count === 1) {
      return {
        status: IdempotencyReservationStatus.RESERVED,
        key: idempotencyKey,
      };
    }

    const existing = await this.findByKeyAndStore(input.key, input.storeId);
    if (!existing) {
      return this.reserve(input);
    }

    if (existing.isExpired()) {
      await this.deleteExpiredRecord(existing.id);
      return this.reserve(input);
    }

    return this.toReservation(existing, input);
  }

  async deleteExpiredForKey(key: string, storeId: string): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: {
        key,
        storeId,
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  async complete(
    id: string,
    responseBody: Record<string, unknown>,
    responseStatus: number,
  ): Promise<IdempotencyKey> {
    const record = await this.prisma.idempotencyKey.update({
      where: { id },
      data: {
        status: PrismaIdempotencyKeyStatus.COMPLETED,
        completedAt: new Date(),
        responseBody: responseBody as any,
        responseStatus,
      },
    });

    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.idempotencyKey.delete({
      where: { id },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Convert a Prisma record to a Domain IdempotencyKey.
   */
  private toDomain(record: {
    id: string;
    key: string;
    storeId: string;
    requestMethod: string;
    requestPath: string;
    requestHash: string;
    responseBody: any | null;
    responseStatus: number | null;
    status: PrismaIdempotencyKeyStatus;
    completedAt: Date | null;
    createdAt: Date;
    expiresAt: Date;
  }): IdempotencyKey {
    const props: IdempotencyKeyProps = {
      id: record.id,
      key: record.key,
      storeId: record.storeId,
      requestMethod: record.requestMethod,
      requestPath: record.requestPath,
      requestHash: record.requestHash,
      responseBody:
        record.responseBody === null
          ? undefined
          : (record.responseBody as Record<string, unknown>),
      responseStatus: record.responseStatus ?? undefined,
      status: record.status as unknown as IdempotencyKeyStatus,
      completedAt: record.completedAt ?? undefined,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    };

    return IdempotencyKey.reconstitute(props);
  }

  private toReservation(
    record: IdempotencyKey,
    input: ReserveIdempotencyKeyProps,
  ): IdempotencyReservation {
    if (
      !record.matchesRequest({
        requestMethod: input.requestMethod,
        requestPath: input.requestPath,
        requestHash: input.requestHash,
      })
    ) {
      return {
        status: IdempotencyReservationStatus.CONFLICT,
        key: record,
      };
    }

    if (record.isCompleted()) {
      return {
        status: IdempotencyReservationStatus.REPLAY,
        key: record,
      };
    }

    return {
      status: IdempotencyReservationStatus.IN_PROGRESS,
      key: record,
    };
  }

  private async deleteExpiredRecord(id: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({
      where: {
        id,
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
