import { IReceiptRepository, Receipt, ReceiptStatus } from "@hockpay/core";
import { PrismaClient, Prisma } from "@hockpay/database";

export class ReceiptRepository implements IReceiptRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async findById(id: string): Promise<Receipt | null> {
    const data = await this.prisma.receipt.findUnique({
      where: { id },
    });

    if (!data) return null;
    return this.toDomain(data);
  }

  async findByPaymentId(paymentId: string): Promise<Receipt | null> {
    const data = await this.prisma.receipt.findUnique({
      where: { paymentId },
    });

    if (!data) return null;
    return this.toDomain(data);
  }

  async findByReceiptNumber(receiptNumber: string): Promise<Receipt | null> {
    const data = await this.prisma.receipt.findUnique({
      where: { receiptNumber },
    });

    if (!data) return null;
    return this.toDomain(data);
  }

  async findByStoreId(
    storeId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: Receipt[]; total: number }> {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where: { storeId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.receipt.count({ where: { storeId } }),
    ]);

    return {
      items: items.map((item) => this.toDomain(item)),
      total,
    };
  }

  async save(receipt: Receipt): Promise<void> {
    await this.prisma.receipt.create({
      data: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        paymentId: receipt.paymentId,
        storeId: receipt.storeId,
        payerName: receipt.payerName,
        payerDocument: receipt.payerDocument,
        payerEmail: receipt.payerEmail,
        payeeName: receipt.payeeName,
        payeeDocument: receipt.payeeDocument,
        amount: receipt.amount,
        fee: receipt.fee,
        netAmount: receipt.netAmount,
        currency: receipt.currency,
        description: receipt.description,
        status: receipt.status as any,
        issuedAt: receipt.issuedAt,
        createdAt: receipt.createdAt,
        updatedAt: receipt.updatedAt,
      },
    });
  }

  async update(receipt: Receipt): Promise<void> {
    await this.prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        status: receipt.status as any,
        updatedAt: receipt.updatedAt,
      },
    });
  }

  async incrementCounter(storeId: string, date: string): Promise<number> {
    const result = await this.prisma.receiptCounter.upsert({
      where: {
        storeId_date: { storeId, date },
      },
      create: { storeId, date, sequence: 1 },
      update: { sequence: { increment: 1 } },
    });

    return result.sequence;
  }

  private toDomain(data: any): Receipt {
    return Receipt.reconstitute({
      id: data.id,
      receiptNumber: data.receiptNumber,
      paymentId: data.paymentId,
      storeId: data.storeId,
      payerName: data.payerName ?? undefined,
      payerDocument: data.payerDocument ?? undefined,
      payerEmail: data.payerEmail ?? undefined,
      payeeName: data.payeeName,
      payeeDocument: data.payeeDocument ?? undefined,
      amount: data.amount,
      fee: data.fee,
      netAmount: data.netAmount,
      currency: data.currency,
      description: data.description ?? undefined,
      status: data.status as ReceiptStatus,
      issuedAt: data.issuedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
