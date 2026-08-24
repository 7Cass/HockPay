import {
  DashboardBalanceMovementProjection,
  DashboardOverviewDto,
  DashboardPerformanceProjection,
  IDashboardOverviewRepository,
} from '@hockpay/core';
import { Prisma, PrismaClient } from '@hockpay/database';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type DateRange = {
  storeId: string;
  startDate: Date;
  endDate: Date;
};

type DashboardRange = DateRange & {
  accountId: string;
};

const APPROVED_PAYMENT_STATUSES = ['CONFIRMED', 'RELEASED'] as const;

export class DashboardOverviewRepository implements IDashboardOverviewRepository {
  constructor(private readonly prisma: PrismaLike) {}

  async getAccountBalanceByStoreId(storeId: string) {
    const account = await this.prisma.account.findUnique({
      where: { storeId },
      select: {
        id: true,
        available: true,
        pending: true,
        blocked: true,
        currency: true,
      },
    });

    if (!account) return null;

    return {
      accountId: account.id,
      available: account.available,
      pending: account.pending,
      blocked: account.blocked,
      currency: account.currency,
    };
  }

  async getPerformance(input: DashboardRange): Promise<DashboardPerformanceProjection> {
    const [paymentReceived, feeCharged] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          accountId: input.accountId,
          type: 'PAYMENT_RECEIVED' as any,
          createdAt: dateRange(input),
        },
        _sum: {
          amount: true,
          netAmount: true,
        },
        _count: {
          id: true,
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          accountId: input.accountId,
          type: 'FEE_CHARGED' as any,
          createdAt: dateRange(input),
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      grossVolume: paymentReceived._sum.amount ?? 0,
      netVolume: paymentReceived._sum.netAmount ?? 0,
      feeVolume: Math.abs(feeCharged._sum.amount ?? 0),
      salesCount: paymentReceived._count.id,
    };
  }

  async getBalanceMovement(input: DashboardRange): Promise<DashboardBalanceMovementProjection> {
    const [
      paymentReceived,
      paymentReleased,
      refundDeducted,
      withdrawalSent,
      withdrawalReversed,
      negativeCompensated,
    ] = await Promise.all([
      this.sumTransactionNetAmount(input, 'PAYMENT_RECEIVED'),
      this.sumTransactionNetAmount(input, 'PAYMENT_RELEASED'),
      this.sumTransactionNetAmount(input, 'REFUND_DEDUCTED'),
      this.sumTransactionNetAmount(input, 'WITHDRAWAL_SENT'),
      this.sumTransactionNetAmount(input, 'WITHDRAWAL_REVERSED'),
      this.sumTransactionNetAmount(input, 'NEGATIVE_COMPENSATED'),
    ]);

    return {
      available:
        paymentReleased -
        refundDeducted -
        withdrawalSent +
        withdrawalReversed +
        negativeCompensated,
      pending: paymentReceived,
    };
  }

  async getChart(input: DashboardRange): Promise<DashboardOverviewDto['chart']> {
    const result = await this.prisma.$queryRaw<
      Array<{
        date: string;
        net_volume: number | bigint;
        sales_count: number | bigint;
      }>
    >`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
        CAST(COALESCE(SUM(net_amount), 0) AS BIGINT) AS net_volume,
        CAST(COUNT(*) AS BIGINT) AS sales_count
      FROM transactions
      WHERE account_id = ${input.accountId}
        AND type = 'PAYMENT_RECEIVED'
        AND created_at >= ${input.startDate}
        AND created_at <= ${input.endDate}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
      ORDER BY TO_CHAR(created_at, 'YYYY-MM-DD') ASC
    `;

    return result.map((row) => ({
      date: row.date,
      netVolume: Number(row.net_volume),
      salesCount: Number(row.sales_count),
    }));
  }

  async getConversion(input: DateRange): Promise<DashboardOverviewDto['conversion']> {
    const paymentWhere = {
      storeId: input.storeId,
      createdAt: dateRange(input),
    };

    const [paymentAttempts, approvedPayments, linksCreated, linksOpened, linksPaid] =
      await Promise.all([
        this.prisma.payment.count({ where: paymentWhere }),
        this.prisma.payment.count({
          where: {
            ...paymentWhere,
            status: { in: [...APPROVED_PAYMENT_STATUSES] as any },
          },
        }),
        this.prisma.paymentLink.count({
          where: {
            storeId: input.storeId,
            createdAt: dateRange(input),
          },
        }),
        this.prisma.paymentLink.count({
          where: {
            storeId: input.storeId,
            OR: [
              { openedAt: dateRange(input) },
              {
                createdAt: dateRange(input),
                openedAt: { not: null },
              },
            ],
          },
        }),
        this.prisma.paymentLink.count({
          where: {
            storeId: input.storeId,
            createdAt: dateRange(input),
            ...paidPaymentLinkWhere(input.storeId),
          },
        }),
      ]);

    return {
      paymentApprovalRate: paymentAttempts > 0 ? approvedPayments / paymentAttempts : 0,
      paymentAttempts,
      approvedPayments,
      linkConversionRate: linksCreated > 0 ? linksPaid / linksCreated : 0,
      linksCreated,
      linksOpened,
      linksPaid,
    };
  }

  async getPaymentStatusBreakdown(
    input: DateRange,
  ): Promise<DashboardOverviewDto['paymentStatusBreakdown']> {
    const rows = await this.prisma.payment.groupBy({
      by: ['status'],
      where: {
        storeId: input.storeId,
        createdAt: dateRange(input),
      },
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
      orderBy: {
        status: 'asc',
      },
    });

    return rows.map((row) => ({
      status: String(row.status),
      count: row._count.id,
      amount: row._sum.amount ?? 0,
    }));
  }

  async getAttention(input: DateRange): Promise<DashboardOverviewDto['attention']> {
    const [
      pendingPayments,
      failedPayments,
      expiredPayments,
      refundedPayments,
      failedWebhookDeliveries,
      pendingWebhookDeliveries,
      failedAlertDeliveries,
      pendingAlertDeliveries,
      expiredLinks,
      cancelledLinks,
    ] = await Promise.all([
      this.countPaymentsByStatus(input, 'PENDING'),
      this.countPaymentsByStatus(input, 'FAILED'),
      this.countPaymentsByStatus(input, 'EXPIRED'),
      this.countPaymentsByStatus(input, 'REFUNDED'),
      this.countFailedWebhookDeliveries(input),
      this.countPendingWebhookDeliveries(input),
      this.countAlertDeliveries(input, 'FAILED'),
      this.countAlertDeliveries(input, 'PENDING'),
      this.countExpiredLinks(input),
      this.prisma.paymentLink.count({
        where: {
          storeId: input.storeId,
          cancelledAt: dateRange(input),
        },
      }),
    ]);

    return {
      pendingPayments,
      failedPayments,
      expiredPayments,
      refundedPayments,
      failedWebhookDeliveries,
      pendingWebhookDeliveries,
      failedAlertDeliveries,
      pendingAlertDeliveries,
      expiredLinks,
      cancelledLinks,
    };
  }

  async getIntegrationsHealth(
    input: DateRange,
  ): Promise<Omit<DashboardOverviewDto['integrationsHealth'], 'environment'>> {
    const [activeWebhooks, activeAlerts, failedWebhookDeliveries, failedAlertDeliveries] =
      await Promise.all([
        this.prisma.webhookConfig.count({
          where: {
            storeId: input.storeId,
            isActive: true,
          },
        }),
        this.prisma.alertConfig.count({
          where: {
            storeId: input.storeId,
            isActive: true,
          },
        }),
        this.countFailedWebhookDeliveries(input),
        this.countAlertDeliveries(input, 'FAILED'),
      ]);

    return {
      activeWebhooks,
      activeAlerts,
      failedWebhookDeliveries,
      failedAlertDeliveries,
    };
  }

  async getRecentPayments(
    storeId: string,
    limit: number,
  ): Promise<DashboardOverviewDto['recentPayments']> {
    const payments = await this.prisma.payment.findMany({
      where: { storeId },
      select: {
        id: true,
        amount: true,
        netAmount: true,
        currency: true,
        status: true,
        description: true,
        payerName: true,
        payerEmail: true,
        customerId: true,
        metadata: true,
        createdAt: true,
        checkoutSession: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      netAmount: payment.netAmount,
      currency: payment.currency,
      status: String(payment.status),
      origin: resolvePaymentOrigin(payment.metadata, Boolean(payment.checkoutSession)),
      description: payment.description ?? undefined,
      payerName: payment.payerName ?? undefined,
      payerEmail: payment.payerEmail ?? undefined,
      customerId: payment.customerId ?? undefined,
      createdAt: payment.createdAt.toISOString(),
    }));
  }

  private countPaymentsByStatus(input: DateRange, status: string): Promise<number> {
    return this.prisma.payment.count({
      where: {
        storeId: input.storeId,
        status: status as any,
        createdAt: dateRange(input),
      },
    });
  }

  private async sumTransactionNetAmount(input: DashboardRange, type: string): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        accountId: input.accountId,
        type: type as any,
        createdAt: dateRange(input),
      },
      _sum: {
        netAmount: true,
      },
    });

    return result._sum.netAmount ?? 0;
  }

  private countFailedWebhookDeliveries(input: DateRange): Promise<number> {
    return this.prisma.webhookLog.count({
      where: {
        config: {
          storeId: input.storeId,
        },
        status: { in: ['FAILED_RETRYABLE', 'FAILED_FINAL'] as any },
        createdAt: dateRange(input),
      },
    });
  }

  private countPendingWebhookDeliveries(input: DateRange): Promise<number> {
    return this.prisma.webhookLog.count({
      where: {
        config: {
          storeId: input.storeId,
        },
        status: 'PENDING' as any,
        createdAt: dateRange(input),
      },
    });
  }

  private countAlertDeliveries(input: DateRange, status: string): Promise<number> {
    return this.prisma.alertDeliveryLog.count({
      where: {
        alertConfig: {
          storeId: input.storeId,
        },
        status: status as any,
        createdAt: dateRange(input),
      },
    });
  }

  private countExpiredLinks(input: DateRange): Promise<number> {
    const now = new Date();
    const upperBound = input.endDate.getTime() < now.getTime() ? input.endDate : now;

    if (upperBound.getTime() < input.startDate.getTime()) {
      return Promise.resolve(0);
    }

    return this.prisma.paymentLink.count({
      where: {
        storeId: input.storeId,
        cancelledAt: null,
        expiresAt: {
          gte: input.startDate,
          lte: upperBound,
        },
        NOT: paidPaymentLinkWhere(input.storeId),
      },
    });
  }
}

function dateRange(input: DateRange): { gte: Date; lte: Date } {
  return {
    gte: input.startDate,
    lte: input.endDate,
  };
}

function paidPaymentLinkWhere(storeId: string) {
  return {
    OR: [
      {
        pixCharge: {
          status: 'PAID' as any,
        },
      },
      {
        pixCharge: {
          payments: {
            some: {
              storeId,
              status: { in: [...APPROVED_PAYMENT_STATUSES] as any },
            },
          },
        },
      },
    ],
  };
}

function resolvePaymentOrigin(
  metadata: Prisma.JsonValue,
  hasCheckoutSession: boolean,
): 'api' | 'checkout' | 'payment_link' | 'unknown' {
  const origin = metadataValue(metadata, 'origin');
  const paymentLinkId = metadataValue(metadata, 'paymentLinkId');

  if (origin === 'payment_link' || paymentLinkId) {
    return 'payment_link';
  }

  if (hasCheckoutSession || origin === 'checkout') {
    return 'checkout';
  }

  if (!origin || origin === 'api') {
    return 'api';
  }

  return 'unknown';
}

function metadataValue(metadata: Prisma.JsonValue, key: string): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const value = metadata[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
