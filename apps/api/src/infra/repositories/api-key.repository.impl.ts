import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  IApiKeyRepository,
  ApiKey as DomainApiKey,
  Environment,
} from '@hockpay/core';
import {
  ApiKey as PrismaApiKey,
  Environment as PrismaEnvironment,
} from '@hockpay/database';

/**
 * Maps between core Environment enum and Prisma Environment values.
 * Both enums have the same string values, so we can safely convert.
 */
function toPrismaEnvironment(env: Environment): PrismaEnvironment {
  const mapping: Record<Environment, PrismaEnvironment> = {
    [Environment.TEST]: PrismaEnvironment.TEST,
    [Environment.LIVE]: PrismaEnvironment.LIVE,
  };
  return mapping[env];
}

function toCoreEnvironment(env: string): Environment {
  const mapping: Record<string, Environment> = {
    TEST: Environment.TEST,
    LIVE: Environment.LIVE,
  };
  const result = mapping[env];
  if (!result) {
    throw new Error(`Invalid environment value: ${env}`);
  }
  return result;
}

/**
 * Infrastructure implementation of IApiKeyRepository.
 *
 * This repository bridges between the domain layer (which uses domain entities)
 * and the infrastructure layer (which uses Prisma ORM).
 *
 * It converts between Prisma models and Domain entities.
 */
@Injectable()
export class ApiKeyRepository implements IApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(apiKey: DomainApiKey): Promise<void> {
    await this.prisma.apiKey.create({
      data: this.toPrisma(apiKey),
    });
  }

  async findById(id: string): Promise<DomainApiKey | null> {
    const prismaApiKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!prismaApiKey) {
      return null;
    }

    return this.toDomain(prismaApiKey);
  }

  async findByKeyHash(
    keyHash: string,
    environment: Environment,
  ): Promise<DomainApiKey | null> {
    const prismaApiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        environment: toPrismaEnvironment(environment),
        revokedAt: null,
      },
    });

    if (!prismaApiKey) {
      return null;
    }

    return this.toDomain(prismaApiKey);
  }

  async findByStoreId(
    storeId: string,
    includeRevoked: boolean = false,
  ): Promise<DomainApiKey[]> {
    const prismaApiKeys = await this.prisma.apiKey.findMany({
      where: {
        storeId,
        revokedAt: includeRevoked ? undefined : null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return prismaApiKeys.map((key) => this.toDomain(key));
  }

  async update(apiKey: DomainApiKey): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: apiKey.lastUsedAt,
        revokedAt: apiKey.revokedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.apiKey.delete({
      where: { id },
    });
  }

  /**
   * Convert a Prisma ApiKey to a Domain ApiKey.
   * This is a private helper method for internal use.
   */
  private toDomain(prismaApiKey: PrismaApiKey): DomainApiKey {
    return DomainApiKey.reconstitute({
      id: prismaApiKey.id,
      storeId: prismaApiKey.storeId,
      keyHash: prismaApiKey.keyHash,
      prefix: prismaApiKey.prefix,
      name: prismaApiKey.name,
      environment: toCoreEnvironment(prismaApiKey.environment),
      lastUsedAt: prismaApiKey.lastUsedAt ?? undefined,
      revokedAt: prismaApiKey.revokedAt ?? undefined,
      createdAt: prismaApiKey.createdAt,
    });
  }

  /**
   * Convert a Domain ApiKey to a Prisma ApiKey.
   * This is a private helper method for internal use.
   */
  private toPrisma(apiKey: DomainApiKey): Omit<PrismaApiKey, 'id'> {
    return {
      storeId: apiKey.storeId,
      keyHash: apiKey.keyHash,
      prefix: apiKey.prefix,
      name: apiKey.name,
      environment: toPrismaEnvironment(apiKey.environment),
      lastUsedAt: apiKey.lastUsedAt ?? null,
      revokedAt: apiKey.revokedAt ?? null,
      createdAt: apiKey.createdAt,
    };
  }
}
