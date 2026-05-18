import {
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

    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.withdrawal.count({ where }),
    ]);

    return {
      withdrawals: withdrawals.map((withdrawal) =>
        this.toDomain(withdrawal as any),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    return where;
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
