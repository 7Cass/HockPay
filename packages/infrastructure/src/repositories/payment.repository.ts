import {
  IPaymentRepository,
  ListPaymentsOptions,
  ListPaymentsResult,
  Payment as DomainPayment,
  PaymentProps,
  PaymentStatus,
  Environment,
} from '@hockpay/core';
import { PrismaClient, Payment as PrismaPayment } from '@hockpay/database';

/**
 * Shared implementation of IPaymentRepository using Prisma.
 *
 * This repository can be used by both API and Worker apps.
 * Each app provides its own PrismaClient instance.
 */
export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(payment: DomainPayment): Promise<void> {
    await this.prisma.payment.create({
      data: {
        id: payment.id,
        storeId: payment.storeId,
        customerId: payment.customerId,
        externalId: payment.externalId,
        amount: payment.amount,
        fee: payment.fee,
        netAmount: payment.netAmount,
        currency: payment.currency,
        description: payment.description,
        status: payment.status as any,
        environment: payment.environment as any,
        pixQrCode: payment.pixQrCode,
        pixCopyPaste: payment.pixCopyPaste,
        pixTxId: payment.pixTxId,
        checkoutUrl: payment.checkoutUrl,
        checkoutToken: payment.checkoutToken,
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

  async findById(id: string): Promise<DomainPayment | null> {
    const prismaPayment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!prismaPayment) {
      return null;
    }

    return this.toDomain(prismaPayment);
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
    });

    if (!prismaPayment) {
      return null;
    }

    return this.toDomain(prismaPayment);
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
    });

    if (!prismaPayment) {
      return null;
    }

    return this.toDomain(prismaPayment);
  }

  async findByPixTxId(pixTxId: string): Promise<DomainPayment | null> {
    const prismaPayment = await this.prisma.payment.findFirst({
      where: { pixTxId },
    });

    if (!prismaPayment) {
      return null;
    }

    return this.toDomain(prismaPayment);
  }

  async findByCheckoutToken(token: string): Promise<DomainPayment | null> {
    const prismaPayment = await this.prisma.payment.findUnique({
      where: { checkoutToken: token },
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
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

  async update(payment: DomainPayment): Promise<void> {
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: payment.status as any,
        pixTxId: payment.pixTxId,
        paidAt: payment.paidAt,
        releasedAt: payment.releasedAt,
        failedReason: payment.failedReason,
        updatedAt: payment.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.payment.delete({
      where: { id },
    });
  }

  async externalIdExists(externalId: string, storeId: string): Promise<boolean> {
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
  private toDomain(prismaPayment: PrismaPayment): DomainPayment {
    const props: PaymentProps = {
      id: prismaPayment.id,
      storeId: prismaPayment.storeId,
      customerId: prismaPayment.customerId,
      externalId: prismaPayment.externalId ?? undefined,
      amount: prismaPayment.amount,
      fee: prismaPayment.fee,
      netAmount: prismaPayment.netAmount,
      currency: prismaPayment.currency,
      description: prismaPayment.description ?? undefined,
      status: prismaPayment.status as PaymentStatus,
      environment: (prismaPayment as any).environment as Environment,
      pixQrCode: prismaPayment.pixQrCode ?? undefined,
      pixCopyPaste: prismaPayment.pixCopyPaste ?? undefined,
      pixTxId: prismaPayment.pixTxId ?? undefined,
      checkoutUrl: prismaPayment.checkoutUrl ?? undefined,
      checkoutToken: (prismaPayment as any).checkoutToken ?? undefined,
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
