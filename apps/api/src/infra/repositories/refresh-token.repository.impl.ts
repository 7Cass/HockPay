import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  IRefreshTokenRepositoryPort,
  RefreshToken as DomainRefreshToken,
} from '@hockpay/core';
import { RefreshToken as PrismaRefreshToken } from '@hockpay/database';

/**
 * Infrastructure implementation of IRefreshTokenRepositoryPort.
 *
 * This repository bridges between domain layer (which uses domain entities)
 * and infrastructure layer (which uses Prisma ORM).
 *
 * It converts between Prisma models and Domain entities.
 */
@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

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

  async findByMerchantId(
    merchantId: string,
  ): Promise<DomainRefreshToken | null> {
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
    // Delete all existing tokens for this merchant (hard delete)
    // This allows creating a new token with the same merchantId
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

  /**
   * Convert a Prisma RefreshToken to a Domain RefreshToken.
   * This is a private helper method for internal use.
   */
  private toDomain(prismaToken: PrismaRefreshToken): DomainRefreshToken {
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
