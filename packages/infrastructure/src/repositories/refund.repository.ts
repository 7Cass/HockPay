import { IRefundRepository, Refund, RefundStatus } from "@hockpay/core";
import { PrismaClient, Prisma } from "@hockpay/database";

export class RefundRepository implements IRefundRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async findById(id: string): Promise<Refund | null> {
    const data = await this.prisma.refund.findUnique({
      where: { id },
    });

    if (!data) return null;
    return this.toDomain(data);
  }

  async findByPaymentId(paymentId: string): Promise<Refund[]> {
    const data = await this.prisma.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: "desc" },
    });

    return data.map((item) => this.toDomain(item));
  }

  async save(refund: Refund): Promise<void> {
    await this.prisma.refund.create({
      data: {
        id: refund.id,
        paymentId: refund.paymentId,
        amount: refund.amount,
        feeRefunded: refund.feeRefunded,
        reason: refund.reason,
        status: refund.status as any,
        processedAt: refund.processedAt,
        createdAt: refund.createdAt,
      },
    });
  }

  async update(refund: Refund): Promise<void> {
    await this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: refund.status as any,
        processedAt: refund.processedAt,
      },
    });
  }

  private toDomain(data: any): Refund {
    return Refund.reconstitute({
      id: data.id,
      paymentId: data.paymentId,
      amount: data.amount,
      feeRefunded: data.feeRefunded,
      reason: data.reason ?? undefined,
      status: data.status as RefundStatus,
      processedAt: data.processedAt ?? undefined,
      createdAt: data.createdAt,
    });
  }
}
