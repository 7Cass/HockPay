import { Email, IOperatorRepository, Operator as DomainOperator } from '@hockpay/core';
import { Operator as PrismaOperator, Prisma, PrismaClient } from '@hockpay/database';

type OperatorRow = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class OperatorRepository implements IOperatorRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(operator: DomainOperator): Promise<void> {
    await this.prisma.operator.create({
      data: {
        id: operator.id,
        email: operator.email.toString(),
        passwordHash: operator.passwordHash,
        name: operator.name,
        isActive: operator.isActive,
        createdAt: operator.createdAt,
        updatedAt: operator.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<DomainOperator | null> {
    const operator = await this.prisma.operator.findUnique({ where: { id } });

    return operator ? this.toDomain(operator) : null;
  }

  async findByIdForUpdate(id: string): Promise<DomainOperator | null> {
    const rows = await this.prisma.$queryRaw<OperatorRow[]>`
      SELECT
        id,
        email,
        password_hash AS "passwordHash",
        name,
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM operators
      WHERE id = ${id}
      FOR UPDATE
    `;

    const row = rows[0];

    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<DomainOperator | null> {
    const operator = await this.prisma.operator.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    return operator ? this.toDomain(operator) : null;
  }

  private toDomain(operator: PrismaOperator | OperatorRow): DomainOperator {
    return DomainOperator.reconstitute({
      id: operator.id,
      email: new Email(operator.email),
      passwordHash: operator.passwordHash,
      name: operator.name,
      isActive: operator.isActive,
      createdAt: operator.createdAt,
      updatedAt: operator.updatedAt,
    });
  }
}
