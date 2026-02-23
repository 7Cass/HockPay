import { Injectable } from '@nestjs/common';
import { Payment as PaymentEntity, PaymentStatus, Prisma } from '@hockpay/database';
import { Payment } from '../../../domain/entities/payment.entity';
import { PrismaService } from '../../database/prisma.service';

/**
 * Implementação do PaymentRepository usando Prisma
 */
@Injectable()
export class PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return null;
    }

    return this.toDomain(payment);
  }

  async findByExternalId(storeId: string, externalId: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: {
        storeId_externalId: {
          storeId,
          externalId,
        },
      },
    });

    if (!payment) {
      return null;
    }

    return this.toDomain(payment);
  }

  async findByPixTxId(pixTxId: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findFirst({
      where: { pixTxId },
    });

    if (!payment) {
      return null;
    }

    return this.toDomain(payment);
  }

  async save(payment: Payment): Promise<Payment> {
    const data = payment.toPersistence();

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: data.status,
        pixTxId: data.pixTxId,
        paidAt: data.paidAt,
        releasedAt: data.releasedAt,
        failedReason: data.failedReason,
        updatedAt: new Date(),
      },
    });

    return this.toDomain(updated);
  }

  async create(payment: Payment): Promise<Payment> {
    const data = payment.toPersistence();

    const created = await this.prisma.payment.create({
      data: {
        id: data.id,
        storeId: data.storeId,
        customerId: data.customerId,
        externalId: data.externalId,
        amount: data.amount,
        fee: data.fee,
        netAmount: data.netAmount,
        currency: data.currency,
        description: data.description,
        status: data.status,
        pixQrCode: data.pixQrCode,
        pixCopyPaste: data.pixCopyPaste,
        pixTxId: data.pixTxId,
        checkoutUrl: data.checkoutUrl,
        expiresAt: data.expiresAt,
        metadata: (data.metadata ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toDomain(created);
  }

  async findByStoreId(
    storeId: string,
    options: {
      status?: PaymentStatus;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Payment[]> {
    const where: any = { storeId };

    if (options.status) {
      where.status = options.status;
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

    const payments = await this.prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      skip: options.offset,
    });

    return payments.map(p => this.toDomain(p));
  }

  async countByStoreId(storeId: string, filters?: { status?: PaymentStatus }): Promise<number> {
    const where: any = { storeId };

    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.payment.count({ where });
  }

  async findExpiredPending(now: Date): Promise<Payment[]> {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        expiresAt: { lt: now },
      },
    });

    return payments.map(p => this.toDomain(p));
  }

  async findConfirmedForRelease(settlementDays: number, beforeDate: Date): Promise<Payment[]> {
    // Busca pagamentos confirmados antes da data especificada
    const cutoffDate = new Date(beforeDate);
    cutoffDate.setDate(cutoffDate.getDate() - settlementDays);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.CONFIRMED,
        paidAt: { lte: cutoffDate },
      },
    });

    return payments.map(p => this.toDomain(p));
  }

  private toDomain(prismaPayment: PaymentEntity): Payment {
    return Payment.fromPersistence({
      id: prismaPayment.id,
      storeId: prismaPayment.storeId,
      customerId: prismaPayment.customerId,
      externalId: prismaPayment.externalId,
      amount: prismaPayment.amount,
      fee: prismaPayment.fee,
      netAmount: prismaPayment.netAmount,
      currency: prismaPayment.currency,
      description: prismaPayment.description,
      status: prismaPayment.status,
      pixQrCode: prismaPayment.pixQrCode,
      pixCopyPaste: prismaPayment.pixCopyPaste,
      pixTxId: prismaPayment.pixTxId,
      checkoutUrl: prismaPayment.checkoutUrl,
      expiresAt: prismaPayment.expiresAt,
      paidAt: prismaPayment.paidAt,
      releasedAt: prismaPayment.releasedAt,
      failedReason: prismaPayment.failedReason,
      metadata: prismaPayment.metadata as Record<string, unknown> | null,
      createdAt: prismaPayment.createdAt,
      updatedAt: prismaPayment.updatedAt,
    });
  }
}
