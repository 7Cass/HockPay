import {
  computePaymentLinkStatus,
  IPaymentLinkRepository,
  ListPaymentLinksOptions,
  ListPaymentLinksResult,
  PaymentLink,
  PaymentLinkListItem,
  PaymentLinkStats,
  PaymentStatus,
  PixChargeStatus,
} from "@hockpay/core";
import { Prisma, PrismaClient } from "@hockpay/database";

export class PaymentLinkRepository implements IPaymentLinkRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
    private readonly checkoutBaseUrl: string,
  ) {}

  async save(link: PaymentLink): Promise<void> {
    await (this.prisma as any).paymentLink.create({
      data: this.toCreateData(link),
    });
  }

  async update(link: PaymentLink): Promise<void> {
    await (this.prisma as any).paymentLink.update({
      where: { id: link.id },
      data: {
        openedAt: link.openedAt,
        cancelledAt: link.cancelledAt,
        updatedAt: link.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<PaymentLink | null> {
    const row = await (this.prisma as any).paymentLink.findUnique({
      where: { id },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByIdAndStoreId(id: string, storeId: string): Promise<PaymentLink | null> {
    const row = await (this.prisma as any).paymentLink.findFirst({
      where: { id, storeId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findListItemByIdAndStoreId(
    id: string,
    storeId: string,
  ): Promise<PaymentLinkListItem | null> {
    const row = await (this.prisma as any).paymentLink.findFirst({
      where: { id, storeId },
      include: this.includePayment(),
    });
    return row ? this.toListItem(row) : null;
  }

  async findByToken(token: string): Promise<PaymentLink | null> {
    const row = await (this.prisma as any).paymentLink.findUnique({
      where: { publicToken: token },
    });
    return row ? this.toDomain(row) : null;
  }

  async findPublicByToken(token: string): Promise<PaymentLinkListItem | null> {
    const row = await (this.prisma as any).paymentLink.findUnique({
      where: { publicToken: token },
      include: this.includePayment(),
    });
    return row ? this.toListItem(row) : null;
  }

  async list(options: ListPaymentLinksOptions): Promise<ListPaymentLinksResult> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = { storeId: options.storeId };

    const [rows, allRows] = await Promise.all([
      (this.prisma as any).paymentLink.findMany({
        where,
        include: this.includePayment(),
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      (this.prisma as any).paymentLink.findMany({
        where,
        include: this.includePayment(),
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const allItems = allRows.map((row: any) => this.toListItem(row));
    const filtered = allItems.filter((item: PaymentLinkListItem) => {
      if (options.status && item.status !== options.status) return false;
      if (options.hasFailures && item.failedPaymentCount <= 0) return false;
      return true;
    });
    const shouldFilterBeforePagination = Boolean(options.status || options.hasFailures);
    const pageItems = shouldFilterBeforePagination
      ? filtered.slice(skip, skip + limit)
      : rows.map((row: any) => this.toListItem(row));

    return {
      items: pageItems,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
      stats: this.buildStats(allItems),
    };
  }

  private includePayment() {
    return {
      pixCharge: {
        include: {
          payments: {
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
        ? {
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
            expiresAt: payment.expiresAt,
            paidAt: payment.paidAt ?? undefined,
            releasedAt: payment.releasedAt ?? undefined,
            failedReason: payment.failedReason ?? undefined,
            metadata: payment.metadata ?? undefined,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
          }
        : null,
      lastFailedAt: lastFailedPayment?.updatedAt ?? null,
    };
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
