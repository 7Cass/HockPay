import {
  IPixChargeRepository,
  PixCharge,
  PixChargeProps,
  PixChargeStatus,
} from "@hockpay/core";
import { Prisma, PrismaClient } from "@hockpay/database";

export class PixChargeRepository implements IPixChargeRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async save(charge: PixCharge): Promise<void> {
    await (this.prisma as any).pixCharge.create({
      data: this.toData(charge),
    });
  }

  async update(charge: PixCharge): Promise<void> {
    await (this.prisma as any).pixCharge.update({
      where: { id: charge.id },
      data: {
        status: charge.status,
        paidAt: charge.paidAt,
        cancelledAt: charge.cancelledAt,
        updatedAt: charge.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<PixCharge | null> {
    const row = await (this.prisma as any).pixCharge.findUnique({
      where: { id },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByIdAndStoreId(
    id: string,
    storeId: string,
  ): Promise<PixCharge | null> {
    const row = await (this.prisma as any).pixCharge.findFirst({
      where: { id, storeId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByPixTxId(pixTxId: string): Promise<PixCharge | null> {
    const row = await (this.prisma as any).pixCharge.findUnique({
      where: { pixTxId },
    });
    return row ? this.toDomain(row) : null;
  }

  private toData(charge: PixCharge) {
    return {
      id: charge.id,
      storeId: charge.storeId,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      pixQrCode: charge.pixQrCode,
      pixCopyPaste: charge.pixCopyPaste,
      pixTxId: charge.pixTxId,
      expiresAt: charge.expiresAt,
      paidAt: charge.paidAt,
      cancelledAt: charge.cancelledAt,
      createdAt: charge.createdAt,
      updatedAt: charge.updatedAt,
    };
  }

  private toDomain(row: any): PixCharge {
    const props: PixChargeProps = {
      id: row.id,
      storeId: row.storeId,
      amount: row.amount,
      currency: row.currency,
      status: row.status as PixChargeStatus,
      pixQrCode: row.pixQrCode,
      pixCopyPaste: row.pixCopyPaste,
      pixTxId: row.pixTxId,
      expiresAt: row.expiresAt,
      paidAt: row.paidAt ?? undefined,
      cancelledAt: row.cancelledAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return PixCharge.reconstitute(props);
  }
}
