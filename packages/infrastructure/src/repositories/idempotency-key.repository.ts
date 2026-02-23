import {
  IIdempotencyKeyRepository,
  IdempotencyKey,
  IdempotencyKeyProps,
} from '@hockpay/core';
import { PrismaClient } from '@hockpay/database';

/**
 * Shared implementation of IIdempotencyKeyRepository using Prisma.
 *
 * This repository can be used by both API and Worker apps.
 * Each app provides its own PrismaClient instance.
 */
export class IdempotencyKeyRepository implements IIdempotencyKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

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

  async save(idempotencyKey: IdempotencyKey): Promise<void> {
    const props = idempotencyKey.toObject();

    await this.prisma.idempotencyKey.create({
      data: {
        id: props.id,
        key: props.key,
        storeId: props.storeId,
        requestPath: props.requestPath,
        requestHash: props.requestHash,
        responseBody: props.responseBody as any,
        responseStatus: props.responseStatus,
        createdAt: props.createdAt,
        expiresAt: props.expiresAt,
      },
    });
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
    requestPath: string;
    requestHash: string;
    responseBody: any;
    responseStatus: number;
    createdAt: Date;
    expiresAt: Date;
  }): IdempotencyKey {
    const props: IdempotencyKeyProps = {
      id: record.id,
      key: record.key,
      storeId: record.storeId,
      requestPath: record.requestPath,
      requestHash: record.requestHash,
      responseBody: record.responseBody as Record<string, unknown>,
      responseStatus: record.responseStatus,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    };

    return IdempotencyKey.reconstitute(props);
  }
}
