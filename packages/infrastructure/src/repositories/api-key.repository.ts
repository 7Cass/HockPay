import {
  IApiKeyRepository,
  ApiKey as DomainApiKey,
  Environment,
} from "@hockpay/core";
import {
  PrismaClient,
  Prisma,
  ApiKey as PrismaApiKey,
  Environment as PrismaEnvironment,
} from "@hockpay/database";

function toPrismaEnvironment(env: Environment): PrismaEnvironment {
  return env === Environment.LIVE
    ? PrismaEnvironment.LIVE
    : PrismaEnvironment.TEST;
}

function toCoreEnvironment(env: string): Environment {
  return env === "LIVE" ? Environment.LIVE : Environment.TEST;
}

export class ApiKeyRepository implements IApiKeyRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async save(apiKey: DomainApiKey): Promise<void> {
    await this.prisma.apiKey.create({
      data: this.toPrisma(apiKey),
    });
  }

  async findById(id: string): Promise<DomainApiKey | null> {
    const prismaApiKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });
    return prismaApiKey ? this.toDomain(prismaApiKey) : null;
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
    return prismaApiKey ? this.toDomain(prismaApiKey) : null;
  }

  async findByStoreId(
    storeId: string,
    includeRevoked = false,
  ): Promise<DomainApiKey[]> {
    const prismaApiKeys = await this.prisma.apiKey.findMany({
      where: {
        storeId,
        revokedAt: includeRevoked ? undefined : null,
      },
      orderBy: { createdAt: "desc" },
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

  private toPrisma(apiKey: DomainApiKey): PrismaApiKey {
    return {
      id: apiKey.id,
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
