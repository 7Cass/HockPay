import { IRefreshTokenRepositoryPort, RefreshToken as DomainRefreshToken } from '@hockpay/core';
import { Prisma, PrismaClient, RefreshToken as PrismaRefreshToken } from '@hockpay/database';

type RefreshTokenRow = {
  id: string;
  token: string;
  merchantId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class RefreshTokenRepository implements IRefreshTokenRepositoryPort {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(token: DomainRefreshToken): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        id: token.id,
        token: token.token,
        merchantId: token.merchantId,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
      },
    });
  }

  async findByToken(token: string): Promise<DomainRefreshToken | null> {
    const prismaToken = await this.prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!prismaToken) {
      return null;
    }

    return this.toDomain(prismaToken);
  }

  async findByTokenForUpdate(token: string): Promise<DomainRefreshToken | null> {
    const rows = await this.prisma.$queryRaw<RefreshTokenRow[]>`
      SELECT
        id,
        token,
        merchant_id AS "merchantId",
        expires_at AS "expiresAt",
        revoked_at AS "revokedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM refresh_tokens
      WHERE token = ${token}
      FOR UPDATE
    `;

    const row = rows[0];
    if (!row) {
      return null;
    }

    return this.toDomain(row);
  }

  async findByMerchantId(merchantId: string): Promise<DomainRefreshToken | null> {
    const prismaToken = await this.prisma.refreshToken.findUnique({
      where: { merchantId },
    });

    if (!prismaToken) {
      return null;
    }

    return this.toDomain(prismaToken);
  }

  async update(token: DomainRefreshToken): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: {
        revokedAt: token.revokedAt,
        updatedAt: token.updatedAt,
      },
    });
  }

  async revokeAllForMerchant(merchantId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { merchantId },
    });
  }

  async deleteExpired(): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        AND: [
          {
            revokedAt: { not: null },
          },
          {
            expiresAt: { lt: new Date() },
          },
        ],
      },
    });
  }

  private toDomain(prismaToken: PrismaRefreshToken | RefreshTokenRow): DomainRefreshToken {
    return DomainRefreshToken.reconstitute({
      id: prismaToken.id,
      token: prismaToken.token,
      merchantId: prismaToken.merchantId,
      expiresAt: prismaToken.expiresAt,
      revokedAt: prismaToken.revokedAt ?? undefined,
      createdAt: prismaToken.createdAt,
      updatedAt: prismaToken.updatedAt,
    });
  }
}
