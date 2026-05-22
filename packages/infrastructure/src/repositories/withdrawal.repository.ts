import {
  ClaimProcessableWithdrawalsOptions,
  IWithdrawalRepository,
  ListWithdrawalsOptions,
  ListWithdrawalsResult,
  Withdrawal as DomainWithdrawal,
  WithdrawalProps,
  WithdrawalStatus,
} from "@hockpay/core";
import {
  Prisma,
  PrismaClient,
  Withdrawal as PrismaWithdrawal,
} from "@hockpay/database";

export class WithdrawalRepository implements IWithdrawalRepository {
  private static readonly PROCESSING_STALE_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async save(withdrawal: DomainWithdrawal): Promise<void> {
    await this.prisma.withdrawal.create({
      data: this.toPrismaData(withdrawal),
    });
  }

  async update(withdrawal: DomainWithdrawal): Promise<void> {
    await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: withdrawal.status as any,
        pixE2eId: withdrawal.pixE2eId,
        paidAt: withdrawal.paidAt,
        failedReason: withdrawal.failedReason,
        processingAttempts: withdrawal.processingAttempts,
        nextProcessAt: withdrawal.nextProcessAt,
        lastProcessingError: withdrawal.lastProcessingError,
        updatedAt: withdrawal.updatedAt,
      } as any,
    });
  }

  async findById(id: string): Promise<DomainWithdrawal | null> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
    });
    return withdrawal ? this.toDomain(withdrawal as any) : null;
  }

  async findByIdForUpdate(id: string): Promise<DomainWithdrawal | null> {
    const withdrawals = await this.prisma.$queryRaw<RawWithdrawalRow[]>(
      Prisma.sql`
        SELECT
          id,
          account_id AS "accountId",
          bank_account_id AS "bankAccountId",
          amount,
          fee,
          net_amount AS "netAmount",
          status,
          pix_e2e_id AS "pixE2eId",
          paid_at AS "paidAt",
          failed_reason AS "failedReason",
          processing_attempts AS "processingAttempts",
          next_process_at AS "nextProcessAt",
          last_processing_error AS "lastProcessingError",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM withdrawals
        WHERE id = ${id}
        FOR UPDATE
      `,
    );

    return withdrawals[0] ? this.toDomain(withdrawals[0] as any) : null;
  }

  async findByIdAndAccountId(
    id: string,
    accountId: string,
  ): Promise<DomainWithdrawal | null> {
    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: { id, accountId },
    });
    return withdrawal ? this.toDomain(withdrawal as any) : null;
  }

  async list(options: ListWithdrawalsOptions): Promise<ListWithdrawalsResult> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(options);

    const [withdrawals, total, summary] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.withdrawal.count({ where }),
      this.getSummary(where),
    ]);

    return {
      withdrawals: withdrawals.map((withdrawal) =>
        this.toDomain(withdrawal as any),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary,
    };
  }

  async countCreatedInRange(
    accountId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    return this.prisma.withdrawal.count({
      where: {
        accountId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });
  }

  async sumAmountCreatedInRange(
    accountId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.prisma.withdrawal.aggregate({
      where: {
        accountId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  async findProcessablePending(
    limit: number,
    now = new Date(),
  ): Promise<DomainWithdrawal[]> {
    const staleProcessingCutoff = new Date(
      now.getTime() - WithdrawalRepository.PROCESSING_STALE_MS,
    );
    const withdrawals = await this.prisma.withdrawal.findMany({
      where: {
        OR: [
          {
            status: WithdrawalStatus.PENDING as any,
            OR: [{ nextProcessAt: null }, { nextProcessAt: { lte: now } }],
          },
          {
            status: WithdrawalStatus.PROCESSING as any,
            updatedAt: { lte: staleProcessingCutoff },
          },
        ],
      } as any,
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return withdrawals.map((withdrawal) => this.toDomain(withdrawal as any));
  }

  async claimProcessableWithdrawals(
    options: ClaimProcessableWithdrawalsOptions,
  ): Promise<DomainWithdrawal[]> {
    const limit = Math.floor(options.limit);
    if (!Number.isFinite(limit) || limit <= 0) {
      return [];
    }

    const now = options.now ?? new Date();
    const staleProcessingBefore =
      options.staleProcessingBefore ??
      new Date(now.getTime() - WithdrawalRepository.PROCESSING_STALE_MS);

    const withdrawals = await this.prisma.$queryRaw<RawWithdrawalRow[]>(
      Prisma.sql`
        WITH candidates AS (
          SELECT id
          FROM withdrawals
          WHERE (
            status = ${WithdrawalStatus.PENDING}::"WithdrawalStatus"
            AND (next_process_at IS NULL OR next_process_at <= ${now})
          )
          OR (
            status = ${WithdrawalStatus.PROCESSING}::"WithdrawalStatus"
            AND updated_at <= ${staleProcessingBefore}
          )
          ORDER BY created_at ASC, id ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE withdrawals AS w
        SET
          status = ${WithdrawalStatus.PROCESSING}::"WithdrawalStatus",
          processing_attempts = w.processing_attempts + 1,
          next_process_at = NULL,
          last_processing_error = NULL,
          updated_at = ${now}
        FROM candidates
        WHERE w.id = candidates.id
        RETURNING
          w.id,
          w.account_id AS "accountId",
          w.bank_account_id AS "bankAccountId",
          w.amount,
          w.fee,
          w.net_amount AS "netAmount",
          w.status,
          w.pix_e2e_id AS "pixE2eId",
          w.paid_at AS "paidAt",
          w.failed_reason AS "failedReason",
          w.processing_attempts AS "processingAttempts",
          w.next_process_at AS "nextProcessAt",
          w.last_processing_error AS "lastProcessingError",
          w.created_at AS "createdAt",
          w.updated_at AS "updatedAt"
      `,
    );

    return withdrawals.map((withdrawal) => this.toDomain(withdrawal as any));
  }

  private buildWhere(
    options: ListWithdrawalsOptions,
  ): Prisma.WithdrawalWhereInput {
    const where: Prisma.WithdrawalWhereInput = {
      accountId: options.accountId,
    };

    if (options.status) {
      where.status = options.status as any;
    }
    if (options.bankAccountId) {
      where.bankAccountId = options.bankAccountId;
    }
    if (options.q?.trim()) {
      const q = options.q.trim();
      const clean = q.replace(/\D/g, "");
      const searchTerms = [q, clean].filter(Boolean);
      where.OR = [
        { id: { contains: q } },
        { pixE2eId: { contains: q } },
        ...searchTerms.map((term) => ({
          bankAccount: {
            OR: [
              { pixKey: { contains: term } },
              { holderDocument: { contains: term } },
              { holderName: { contains: term } },
            ],
          },
        })),
      ] as any;
    }
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    return where;
  }

  private async getSummary(where: Prisma.WithdrawalWhereInput) {
    const [aggregate, groups] = await Promise.all([
      this.prisma.withdrawal.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          amount: true,
          fee: true,
          netAmount: true,
        },
      }),
      this.prisma.withdrawal.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        _sum: {
          amount: true,
          netAmount: true,
        },
      }),
    ]);

    const byStatus = new Map(
      groups.map((group) => [
        group.status as WithdrawalStatus,
        {
          count: group._count._all,
          amount: group._sum.amount ?? 0,
          netAmount: group._sum.netAmount ?? 0,
        },
      ]),
    );
    const pending = byStatus.get(WithdrawalStatus.PENDING);
    const processing = byStatus.get(WithdrawalStatus.PROCESSING);
    const completed = byStatus.get(WithdrawalStatus.COMPLETED);
    const failed = byStatus.get(WithdrawalStatus.FAILED);

    return {
      totalCount: aggregate._count._all,
      totalAmount: aggregate._sum.amount ?? 0,
      totalFee: aggregate._sum.fee ?? 0,
      totalNetAmount: aggregate._sum.netAmount ?? 0,
      pendingCount: pending?.count ?? 0,
      processingCount: processing?.count ?? 0,
      completedCount: completed?.count ?? 0,
      failedCount: failed?.count ?? 0,
      pendingOrProcessingAmount:
        (pending?.amount ?? 0) + (processing?.amount ?? 0),
      completedNetAmount: completed?.netAmount ?? 0,
      failedAmount: failed?.amount ?? 0,
    };
  }

  private toPrismaData(withdrawal: DomainWithdrawal) {
    return {
      id: withdrawal.id,
      accountId: withdrawal.accountId,
      bankAccountId: withdrawal.bankAccountId,
      amount: withdrawal.amount,
      fee: withdrawal.fee,
      netAmount: withdrawal.netAmount,
      status: withdrawal.status as any,
      pixE2eId: withdrawal.pixE2eId,
      paidAt: withdrawal.paidAt,
      failedReason: withdrawal.failedReason,
      processingAttempts: withdrawal.processingAttempts,
      nextProcessAt: withdrawal.nextProcessAt,
      lastProcessingError: withdrawal.lastProcessingError,
      createdAt: withdrawal.createdAt,
      updatedAt: withdrawal.updatedAt,
    } as any;
  }

  private toDomain(
    prismaWithdrawal: PrismaWithdrawal & Record<string, any>,
  ): DomainWithdrawal {
    const props: WithdrawalProps = {
      id: prismaWithdrawal.id,
      accountId: prismaWithdrawal.accountId,
      bankAccountId: prismaWithdrawal.bankAccountId,
      amount: prismaWithdrawal.amount,
      fee: prismaWithdrawal.fee,
      netAmount: prismaWithdrawal.netAmount,
      status: prismaWithdrawal.status as WithdrawalStatus,
      pixE2eId: prismaWithdrawal.pixE2eId ?? undefined,
      paidAt: prismaWithdrawal.paidAt ?? undefined,
      failedReason: prismaWithdrawal.failedReason ?? undefined,
      processingAttempts: prismaWithdrawal.processingAttempts ?? 0,
      nextProcessAt: prismaWithdrawal.nextProcessAt ?? undefined,
      lastProcessingError: prismaWithdrawal.lastProcessingError ?? undefined,
      createdAt: prismaWithdrawal.createdAt,
      updatedAt: prismaWithdrawal.updatedAt,
    };

    return DomainWithdrawal.reconstitute(props);
  }
}

type RawWithdrawalRow = PrismaWithdrawal & {
  accountId: string;
  bankAccountId: string;
  netAmount: number;
  pixE2eId: string | null;
  paidAt: Date | null;
  failedReason: string | null;
  processingAttempts: number;
  nextProcessAt: Date | null;
  lastProcessingError: string | null;
  createdAt: Date;
  updatedAt: Date;
};
