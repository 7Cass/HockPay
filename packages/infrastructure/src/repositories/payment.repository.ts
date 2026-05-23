import {
  IPaymentRepository,
  ListPaymentsOptions,
  ListPaymentsResult,
  Payment as DomainPayment,
  PaymentProps,
  PaymentStatus,
  Environment,
  PixChargeStatus,
  LineItemObject,
} from "@hockpay/core";
import {
  PrismaClient,
  Payment as PrismaPayment,
  Prisma,
} from "@hockpay/database";

type PaymentLockRow = {
  id: string;
};

/**
 * Shared implementation of IPaymentRepository using Prisma.
 *
 * This repository can be used by both API and Worker apps.
 * Each app provides its own PrismaClient instance.
 */
export class PaymentRepository implements IPaymentRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async save(payment: DomainPayment): Promise<void> {
    await this.prisma.payment.create({
      data: {
        id: payment.id,
        storeId: payment.storeId,
        customerId: payment.customerId ?? null,
        pixChargeId: payment.pixChargeId ?? null,
        externalId: payment.externalId,
        amount: payment.amount,
        fee: payment.fee,
        netAmount: payment.netAmount,
        currency: payment.currency,
        description: payment.description,
        payerName: payment.payerName,
        payerDocument: payment.payerDocument,
        payerEmail: payment.payerEmail,
        status: payment.status as any,
        environment: payment.environment as any,
        paymentMethod: payment.paymentMethod as any,
        paymentDetails: payment.paymentDetails as any,
        acquirerId: payment.acquirerId,
        totalRefunded: payment.totalRefunded,
        expiresAt: payment.expiresAt,
        paidAt: payment.paidAt,
        releasedAt: payment.releasedAt,
        failedReason: payment.failedReason,
        metadata: payment.metadata as any,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  }

  async saveItems(paymentId: string, items: LineItemObject[]): Promise<void> {
    if (items.length === 0) return;
    await this.prisma.paymentItem.createMany({
      data: items.map((item) => ({
        id: item.id ?? crypto.randomUUID(),
        paymentId,
        productId: item.productId ?? null,
        productExternalId: item.productExternalId ?? null,
        name: item.name,
        description: item.description ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        imageUrl: item.imageUrl ?? null,
        metadata: item.metadata as any,
        createdAt: item.createdAt ?? new Date(),
        updatedAt: item.updatedAt ?? new Date(),
      })),
    });
  }

  async findById(id: string): Promise<DomainPayment | null> {
    const prismaPayment = await this.prisma.payment.findUnique({
      where: { id },
      include: this.includePixCharge(),
    });

    if (!prismaPayment) {
      return null;
    }

    return this.toDomain(prismaPayment);
  }

  async findByIdForUpdate(id: string): Promise<DomainPayment | null> {
    const rows = await this.prisma.$queryRaw<PaymentLockRow[]>`
      SELECT id
      FROM payments
      WHERE id = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.findById(row.id) : null;
  }

  async findByIdAndStoreId(
    id: string,
    storeId: string,
  ): Promise<DomainPayment | null> {
    const prismaPayment = await this.prisma.payment.findFirst({
      where: {
        id,
        storeId,
      },
      include: this.includePixCharge(),
    });

    if (!prismaPayment) {
      return null;
    }

    return this.toDomain(prismaPayment);
  }

  async findByIdAndStoreIdForUpdate(
    id: string,
    storeId: string,
  ): Promise<DomainPayment | null> {
    const rows = await this.prisma.$queryRaw<PaymentLockRow[]>`
      SELECT id
      FROM payments
      WHERE id = ${id}
        AND store_id = ${storeId}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? this.findByIdAndStoreId(row.id, storeId) : null;
  }

  async findByExternalIdAndStoreId(
    externalId: string,
    storeId: string,
  ): Promise<DomainPayment | null> {
    const prismaPayment = await this.prisma.payment.findFirst({
      where: {
        externalId,
        storeId,
      },
      include: this.includePixCharge(),
    });

    if (!prismaPayment) {
      return null;
    }

    return this.toDomain(prismaPayment);
  }

  async findByPixTxId(pixTxId: string): Promise<DomainPayment | null> {
    const prismaPayment = await this.prisma.payment.findFirst({
      where: {
        pixCharge: { pixTxId },
      } as any,
      include: this.includePixCharge(),
    });

    if (!prismaPayment) {
      return null;
    }

    return this.toDomain(prismaPayment);
  }
  async list(options: ListPaymentsOptions): Promise<ListPaymentsResult> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {
      storeId: options.storeId,
    };

    if (options.status) {
      where.status = options.status;
    }

    if (options.customerId) {
      where.customerId = options.customerId;
    }

    if (options.externalId) {
      where.externalId = options.externalId;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const [prismaPayments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: this.includePixCharge(),
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.payment.count({ where }),
    ]);

    const payments = prismaPayments.map((p) => this.toDomain(p));

    return {
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByPixChargeIdAndStoreId(
    pixChargeId: string,
    storeId: string,
  ): Promise<DomainPayment[]> {
    const prismaPayments = await this.prisma.payment.findMany({
      where: {
        pixChargeId,
        storeId,
      },
      include: this.includePixCharge(),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return prismaPayments.map((p) => this.toDomain(p));
  }

  async listByPixChargeIdsAndStoreId(
    pixChargeIds: string[],
    storeId: string,
  ): Promise<DomainPayment[]> {
    const uniquePixChargeIds = [...new Set(pixChargeIds)].filter(Boolean);
    if (uniquePixChargeIds.length === 0) return [];

    const prismaPayments = await this.prisma.payment.findMany({
      where: {
        pixChargeId: { in: uniquePixChargeIds },
        storeId,
      },
      include: this.includePixCharge(),
      orderBy: [{ pixChargeId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    return prismaPayments.map((p) => this.toDomain(p));
  }

  async update(payment: DomainPayment): Promise<void> {
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: payment.status as any,
        paidAt: payment.paidAt,
        releasedAt: payment.releasedAt,
        failedReason: payment.failedReason,
        totalRefunded: payment.totalRefunded,
        payerName: payment.payerName,
        payerDocument: payment.payerDocument,
        payerEmail: payment.payerEmail,
        updatedAt: payment.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.payment.delete({
      where: { id },
    });
  }

  async externalIdExists(
    externalId: string,
    storeId: string,
  ): Promise<boolean> {
    const count = await this.prisma.payment.count({
      where: {
        externalId,
        storeId,
      },
    });

    return count > 0;
  }

  /**
   * Convert a Prisma Payment to a Domain Payment.
   */
  private includePixCharge() {
    return {
      pixCharge: true,
      items: { orderBy: { createdAt: "asc" as const } },
    };
  }

  private toDomain(
    prismaPayment: PrismaPayment & { pixCharge?: any; items?: any[] },
  ): DomainPayment {
    const props: PaymentProps = {
      id: prismaPayment.id,
      storeId: prismaPayment.storeId,
      customerId: prismaPayment.customerId ?? undefined,
      pixChargeId: (prismaPayment as any).pixChargeId ?? undefined,
      externalId: prismaPayment.externalId ?? undefined,
      amount: prismaPayment.amount,
      fee: prismaPayment.fee,
      netAmount: prismaPayment.netAmount,
      currency: prismaPayment.currency,
      description: prismaPayment.description ?? undefined,
      payerName: (prismaPayment as any).payerName ?? undefined,
      payerDocument: (prismaPayment as any).payerDocument ?? undefined,
      payerEmail: (prismaPayment as any).payerEmail ?? undefined,
      status: prismaPayment.status as PaymentStatus,
      environment: (prismaPayment as any).environment as Environment,
      paymentMethod: (prismaPayment as any).paymentMethod,
      paymentDetails:
        ((prismaPayment as any).paymentDetails as Record<string, unknown>) ??
        undefined,
      acquirerId: (prismaPayment as any).acquirerId ?? undefined,
      totalRefunded: (prismaPayment as any).totalRefunded ?? 0,
      pixCharge: prismaPayment.pixCharge
        ? {
            id: prismaPayment.pixCharge.id,
            storeId: prismaPayment.pixCharge.storeId,
            amount: prismaPayment.pixCharge.amount,
            currency: prismaPayment.pixCharge.currency,
            status: prismaPayment.pixCharge.status as PixChargeStatus,
            pixQrCode: prismaPayment.pixCharge.pixQrCode,
            pixCopyPaste: prismaPayment.pixCharge.pixCopyPaste,
            pixTxId: prismaPayment.pixCharge.pixTxId,
            expiresAt: prismaPayment.pixCharge.expiresAt,
            paidAt: prismaPayment.pixCharge.paidAt ?? undefined,
            cancelledAt: prismaPayment.pixCharge.cancelledAt ?? undefined,
            createdAt: prismaPayment.pixCharge.createdAt,
            updatedAt: prismaPayment.pixCharge.updatedAt,
          }
        : undefined,
      items: (prismaPayment.items ?? []).map((item: any) => ({
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
      })),
      expiresAt: prismaPayment.expiresAt,
      paidAt: prismaPayment.paidAt ?? undefined,
      releasedAt: prismaPayment.releasedAt ?? undefined,
      failedReason: prismaPayment.failedReason ?? undefined,
      metadata:
        (prismaPayment.metadata as Record<string, unknown>) ?? undefined,
      createdAt: prismaPayment.createdAt,
      updatedAt: prismaPayment.updatedAt,
    };

    return DomainPayment.reconstitute(props);
  }
}
