import {
  computePaymentLinkStatus,
  IPaymentLinkRepository,
  ListPaymentLinksOptions,
  ListPaymentLinksResult,
  PaymentLink,
  PaymentLinkListItem,
  PaymentLinkStats,
  PaymentObject,
  PaymentStatus,
  PixChargeStatus,
} from "@hockpay/core";
import { Prisma, PrismaClient } from "@hockpay/database";

type PaymentLinkLockRow = {
  id: string;
};

type PaymentLinkStatsRow = {
  total: number | bigint;
  active: number | bigint;
  opened: number | bigint;
  pending: number | bigint;
  paid: number | bigint;
  expired: number | bigint;
  cancelled: number | bigint;
  paidAmount: number | bigint;
};

export class PaymentLinkRepository implements IPaymentLinkRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
    private readonly checkoutBaseUrl: string,
  ) {}

  async save(link: PaymentLink): Promise<void> {
    await this.prisma.paymentLink.create({
      data: this.toCreateData(link),
    });
  }

  async update(link: PaymentLink): Promise<void> {
    await this.prisma.paymentLink.update({
      where: { id: link.id },
      data: {
        openedAt: link.openedAt,
        cancelledAt: link.cancelledAt,
        updatedAt: link.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<PaymentLink | null> {
    const row = await this.prisma.paymentLink.findUnique({
      where: { id },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByIdAndStoreId(id: string, storeId: string): Promise<PaymentLink | null> {
    const row = await this.prisma.paymentLink.findFirst({
      where: { id, storeId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByIdAndStoreIdForUpdate(
    id: string,
    storeId: string,
  ): Promise<PaymentLink | null> {
    const rows = await this.prisma.$queryRaw<PaymentLinkLockRow[]>`
      SELECT id
      FROM payment_links
      WHERE id = ${id}
        AND store_id = ${storeId}
      FOR UPDATE
    `;

    return rows[0] ? this.findByIdAndStoreId(rows[0].id, storeId) : null;
  }

  async findListItemByIdAndStoreId(
    id: string,
    storeId: string,
  ): Promise<PaymentLinkListItem | null> {
    const row = await this.prisma.paymentLink.findFirst({
      where: { id, storeId },
      include: this.includePayment(),
    });
    return row ? this.toListItem(row) : null;
  }

  async findByToken(token: string): Promise<PaymentLink | null> {
    const row = await this.prisma.paymentLink.findUnique({
      where: { publicToken: token },
    });
    return row ? this.toDomain(row) : null;
  }

  async findPublicByToken(token: string): Promise<PaymentLinkListItem | null> {
    const row = await this.prisma.paymentLink.findUnique({
      where: { publicToken: token },
      include: this.includePayment(),
    });
    return row ? this.toListItem(row) : null;
  }

  async findPublicByTokenForUpdate(
    token: string,
  ): Promise<PaymentLinkListItem | null> {
    const rows = await this.prisma.$queryRaw<PaymentLinkLockRow[]>`
      SELECT id
      FROM payment_links
      WHERE public_token = ${token}
      FOR UPDATE
    `;

    const lock = rows[0];
    if (!lock) return null;

    const row = await this.prisma.paymentLink.findUnique({
      where: { id: lock.id },
      include: this.includePayment(),
    });
    return row ? this.toListItem(row) : null;
  }

  async list(options: ListPaymentLinksOptions): Promise<ListPaymentLinksResult> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;
    const now = new Date();

    const [pageRows, totalRows, statsRows] = await Promise.all([
      this.queryListPageIds(options, skip, limit, now),
      this.queryListTotal(options, now),
      this.queryListStats(options, now),
    ]);

    const pageIds = pageRows.map((row) => row.id);
    const hydrated =
      pageIds.length === 0
        ? []
        : await this.prisma.paymentLink.findMany({
            where: { id: { in: pageIds } },
            include: this.includePayment(),
          });
    const byId = new Map<string, any>(
      hydrated.map((row: any) => [row.id, row]),
    );
    const items = pageIds.flatMap((id) => {
      const row = byId.get(id);
      return row ? [this.toListItem(row)] : [];
    });

    const total = Number(totalRows[0]?.total ?? 0);
    const stats = this.statsFromAggregate(statsRows[0]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / Math.max(limit, 1)),
      stats,
    };
  }

  private queryListPageIds(
    options: ListPaymentLinksOptions,
    skip: number,
    limit: number,
    now: Date,
  ): Promise<Array<{ id: string }>> {
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT pl.id
        ${this.listFromSql()}
        ${this.listWhereSql(options, now, { applyListFilters: true })}
        ORDER BY pl.created_at DESC, pl.id DESC
        OFFSET ${skip}
        LIMIT ${limit}
      `,
    );
  }

  private queryListTotal(
    options: ListPaymentLinksOptions,
    now: Date,
  ): Promise<Array<{ total: number | bigint }>> {
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        ${this.listFromSql()}
        ${this.listWhereSql(options, now, { applyListFilters: true })}
      `,
    );
  }

  private queryListStats(
    options: ListPaymentLinksOptions,
    now: Date,
  ): Promise<Array<PaymentLinkStatsRow>> {
    const derived = this.derivedStatusSql(now);
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE ${derived} = 'ACTIVE')::int AS active,
          COUNT(*) FILTER (WHERE pl.opened_at IS NOT NULL)::int AS opened,
          COUNT(*) FILTER (WHERE ${derived} = 'OPENED')::int AS pending,
          COUNT(*) FILTER (WHERE ${derived} = 'PAID')::int AS paid,
          COUNT(*) FILTER (WHERE ${derived} = 'EXPIRED')::int AS expired,
          COUNT(*) FILTER (WHERE ${derived} = 'CANCELLED')::int AS cancelled,
          COALESCE(SUM(pl.amount) FILTER (WHERE ${derived} = 'PAID'), 0)::int AS "paidAmount"
        ${this.listFromSql()}
        ${this.listWhereSql(options, now, { applyListFilters: false })}
      `,
    );
  }

  private listFromSql(): Prisma.Sql {
    return Prisma.sql`
      FROM payment_links pl
      JOIN pix_charges pc ON pc.id = pl.pix_charge_id
    `;
  }

  private listWhereSql(
    options: ListPaymentLinksOptions,
    now: Date,
    flags: { applyListFilters: boolean },
  ): Prisma.Sql {
    const derived = this.derivedStatusSql(now);
    return Prisma.sql`
      WHERE pl.store_id = ${options.storeId}
        AND pl.environment = ${options.environment}::"Environment"
        ${
          flags.applyListFilters && options.status
            ? Prisma.sql`AND (${derived}) = ${options.status}`
            : Prisma.empty
        }
        ${
          flags.applyListFilters && options.hasFailures
            ? Prisma.sql`AND EXISTS (
                SELECT 1
                FROM payments p
                WHERE p.pix_charge_id = pl.pix_charge_id
                  AND p.status = ${PaymentStatus.FAILED}::"PaymentStatus"
              )`
            : Prisma.empty
        }
    `;
  }

  private derivedStatusSql(now: Date): Prisma.Sql {
    return Prisma.sql`
      CASE
        WHEN pl.cancelled_at IS NOT NULL THEN 'CANCELLED'
        WHEN pc.status = ${PixChargeStatus.PAID}::"PixChargeStatus"
          OR EXISTS (
            SELECT 1
            FROM payments p
            WHERE p.pix_charge_id = pl.pix_charge_id
              AND p.status IN (
                ${PaymentStatus.CONFIRMED}::"PaymentStatus",
                ${PaymentStatus.RELEASED}::"PaymentStatus"
              )
          )
        THEN 'PAID'
        WHEN pc.status IN (
            ${PixChargeStatus.EXPIRED}::"PixChargeStatus",
            ${PixChargeStatus.CANCELLED}::"PixChargeStatus"
          )
          OR EXISTS (
            SELECT 1
            FROM payments p
            WHERE p.pix_charge_id = pl.pix_charge_id
              AND p.status = ${PaymentStatus.EXPIRED}::"PaymentStatus"
          )
          OR (pl.expires_at IS NOT NULL AND pl.expires_at < ${now})
        THEN CASE
          WHEN pc.status = ${PixChargeStatus.CANCELLED}::"PixChargeStatus"
          THEN 'CANCELLED'
          ELSE 'EXPIRED'
        END
        WHEN pl.opened_at IS NOT NULL
          OR EXISTS (
            SELECT 1
            FROM payments p
            WHERE p.pix_charge_id = pl.pix_charge_id
              AND p.status = ${PaymentStatus.PENDING}::"PaymentStatus"
          )
        THEN 'OPENED'
        ELSE 'ACTIVE'
      END
    `;
  }

  private statsFromAggregate(
    row: PaymentLinkStatsRow | undefined,
  ): PaymentLinkStats {
    const total = Number(row?.total ?? 0);
    const paid = Number(row?.paid ?? 0);
    return {
      total,
      active: Number(row?.active ?? 0),
      opened: Number(row?.opened ?? 0),
      pending: Number(row?.pending ?? 0),
      paid,
      expired: Number(row?.expired ?? 0),
      cancelled: Number(row?.cancelled ?? 0),
      conversionRate: total > 0 ? paid / total : 0,
      paidAmount: Number(row?.paidAmount ?? 0),
    };
  }

  private includePayment() {
    return {
      pixCharge: {
        include: {
          payments: {
            include: { items: { orderBy: { createdAt: "asc" } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    };
  }

  private toCreateData(link: PaymentLink) {
    return {
      id: link.id,
      storeId: link.storeId,
      pixChargeId: link.pixChargeId,
      publicToken: link.publicToken,
      amount: link.amount,
      currency: link.currency,
      environment: link.environment as any,
      title: link.title,
      description: link.description,
      internalReference: link.internalReference,
      expiresAt: link.expiresAt,
      openedAt: link.openedAt,
      cancelledAt: link.cancelledAt,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }

  private toDomain(row: any): PaymentLink {
    return PaymentLink.reconstitute({
      id: row.id,
      storeId: row.storeId,
      pixChargeId: row.pixChargeId,
      publicToken: row.publicToken,
      amount: row.amount,
      currency: row.currency,
      environment: row.environment,
      title: row.title ?? undefined,
      description: row.description ?? undefined,
      internalReference: row.internalReference ?? undefined,
      expiresAt: row.expiresAt ?? null,
      openedAt: row.openedAt ?? undefined,
      cancelledAt: row.cancelledAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private toListItem(row: any): PaymentLinkListItem {
    const link = this.toDomain(row).toObject();
    const payments = row.pixCharge?.payments ?? [];
    const payment =
      payments.find((p: any) =>
        [PaymentStatus.CONFIRMED, PaymentStatus.RELEASED].includes(
          p.status as PaymentStatus,
        ),
      ) ?? payments[0];
    const paymentStatus = (payment?.status as PaymentStatus | undefined) ?? null;
    const failedPayments = payments.filter(
      (p: any) => p.status === PaymentStatus.FAILED,
    );
    const lastFailedPayment = failedPayments[0];
    const pixCharge = {
      id: row.pixCharge.id,
      storeId: row.pixCharge.storeId,
      amount: row.pixCharge.amount,
      currency: row.pixCharge.currency,
      status: row.pixCharge.status as PixChargeStatus,
      pixQrCode: row.pixCharge.pixQrCode,
      pixCopyPaste: row.pixCharge.pixCopyPaste,
      pixTxId: row.pixCharge.pixTxId,
      expiresAt: row.pixCharge.expiresAt ?? null,
      paidAt: row.pixCharge.paidAt ?? undefined,
      cancelledAt: row.pixCharge.cancelledAt ?? undefined,
      createdAt: row.pixCharge.createdAt,
      updatedAt: row.pixCharge.updatedAt,
    };
    const attempts = this.enrichPaymentAttempts(
      [...payments]
        .sort((a: any, b: any) => {
          const createdDiff =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          if (createdDiff !== 0) return createdDiff;
          return a.id.localeCompare(b.id);
        })
        .map((attempt: any) => this.toPaymentObject(attempt, pixCharge)),
    );

    return {
      ...link,
      checkoutUrl: `${this.checkoutBaseUrl}/pay/${link.publicToken}`,
      status: computePaymentLinkStatus({
        link,
        paymentStatus,
        pixChargeStatus: pixCharge.status,
      }),
      paymentId: payment?.id ?? null,
      paymentStatus,
      pixCharge,
      failedPaymentCount: failedPayments.length,
      lastPaymentId: payment?.id ?? null,
      lastPaymentStatus: paymentStatus,
      lastPayment: payment
        ? this.toPaymentObject(payment, pixCharge)
        : null,
      lastFailedAt: lastFailedPayment?.updatedAt ?? null,
      attempts,
    };
  }

  private toPaymentObject(payment: any, pixCharge: PaymentLinkListItem["pixCharge"]) {
    return {
      id: payment.id,
      storeId: payment.storeId,
      customerId: payment.customerId ?? undefined,
      pixChargeId: payment.pixChargeId ?? undefined,
      externalId: payment.externalId ?? undefined,
      amount: payment.amount,
      fee: payment.fee,
      netAmount: payment.netAmount,
      currency: payment.currency,
      description: payment.description ?? undefined,
      payerName: payment.payerName ?? undefined,
      payerDocument: payment.payerDocument ?? undefined,
      payerEmail: payment.payerEmail ?? undefined,
      status: payment.status as PaymentStatus,
      environment: payment.environment,
      paymentMethod: payment.paymentMethod,
      paymentDetails: payment.paymentDetails ?? undefined,
      acquirerId: payment.acquirerId ?? undefined,
      totalRefunded: payment.totalRefunded ?? 0,
      pixCharge,
      items: this.toLineItems(payment.items ?? []),
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt ?? undefined,
      releasedAt: payment.releasedAt ?? undefined,
      failedReason: payment.failedReason ?? undefined,
      metadata: payment.metadata ?? undefined,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private toLineItems(rows: any[]) {
    return rows.map((item) => ({
      id: item.id,
      productId: item.productId ?? undefined,
      productExternalId: item.productExternalId ?? undefined,
      name: item.name,
      description: item.description ?? undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      imageUrl: item.imageUrl ?? undefined,
      metadata: (item.metadata as Record<string, unknown>) ?? undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  private enrichPaymentAttempts(payments: PaymentObject[]): PaymentObject[] {
    const attemptCount = payments.length;

    return payments.map((payment, index) => ({
      ...payment,
      paymentLinkId: this.getStringMetadata(payment, "paymentLinkId"),
      paymentOrigin: this.getStringMetadata(payment, "origin"),
      attemptNumber: index + 1,
      attemptCount,
      isLatestAttempt: index === attemptCount - 1,
    }));
  }

  private getStringMetadata(payment: PaymentObject, key: string): string | undefined {
    const value = payment.metadata?.[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private buildStats(items: PaymentLinkListItem[]): PaymentLinkStats {
    const paidItems = items.filter((item) => item.status === "PAID");
    const opened = items.filter((item) => item.openedAt).length;
    const total = items.length;
    return {
      total,
      active: items.filter((item) => item.status === "ACTIVE").length,
      opened,
      pending: items.filter((item) => item.status === "OPENED").length,
      paid: paidItems.length,
      expired: items.filter((item) => item.status === "EXPIRED").length,
      cancelled: items.filter((item) => item.status === "CANCELLED").length,
      conversionRate: total > 0 ? paidItems.length / total : 0,
      paidAmount: paidItems.reduce((sum, item) => sum + item.amount, 0),
    };
  }
}
