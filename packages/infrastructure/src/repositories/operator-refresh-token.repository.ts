import {
  IOperatorRefreshTokenRepository,
  OperatorRefreshToken as DomainOperatorRefreshToken,
} from '@hockpay/core';
import {
  OperatorRefreshToken as PrismaOperatorRefreshToken,
  Prisma,
  PrismaClient,
} from '@hockpay/database';

type OperatorRefreshTokenRow = {
  id: string;
  token: string;
  operatorId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class OperatorRefreshTokenRepository implements IOperatorRefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(token: DomainOperatorRefreshToken): Promise<void> {
    await this.prisma.operatorRefreshToken.create({
      data: {
        id: token.id,
        token: token.token,
        operatorId: token.operatorId,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
      },
    });
  }

  async findByToken(token: string): Promise<DomainOperatorRefreshToken | null> {
    const row = await this.prisma.operatorRefreshToken.findUnique({ where: { token } });

    return row ? this.toDomain(row) : null;
  }

  async findByOperatorId(operatorId: string): Promise<DomainOperatorRefreshToken | null> {
    const row = await this.prisma.operatorRefreshToken.findUnique({
      where: { operatorId },
    });

    return row ? this.toDomain(row) : null;
  }

  async findByTokenForUpdate(token: string): Promise<DomainOperatorRefreshToken | null> {
    const rows = await this.prisma.$queryRaw<OperatorRefreshTokenRow[]>`
      SELECT
        id,
        token,
        operator_id AS "operatorId",
        expires_at AS "expiresAt",
        revoked_at AS "revokedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM operator_refresh_tokens
      WHERE token = ${token}
      FOR UPDATE
    `;

    const row = rows[0];

    return row ? this.toDomain(row) : null;
  }

  async update(token: DomainOperatorRefreshToken): Promise<void> {
    await this.prisma.operatorRefreshToken.update({
      where: { id: token.id },
      data: {
        revokedAt: token.revokedAt,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Hard delete, like the merchant side: the unique operator_id means a new
   * token cannot be created while the old row is still there.
   */
  async revokeAllForOperator(operatorId: string): Promise<void> {
    await this.prisma.operatorRefreshToken.deleteMany({ where: { operatorId } });
  }

  private toDomain(
    token: PrismaOperatorRefreshToken | OperatorRefreshTokenRow,
  ): DomainOperatorRefreshToken {
    return DomainOperatorRefreshToken.reconstitute({
      id: token.id,
      token: token.token,
      operatorId: token.operatorId,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt ?? undefined,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    });
  }
}
