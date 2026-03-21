import {
  ICheckoutSessionRepository,
  CheckoutSession as DomainCheckoutSession,
} from '@hockpay/core';
import { PrismaClient, Prisma, CheckoutSession } from '@hockpay/database';

export class CheckoutSessionRepository implements ICheckoutSessionRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) { }

  async save(session: DomainCheckoutSession): Promise<void> {
    await this.prisma.checkoutSession.upsert({
      where: { id: session.id },
      update: {
        status: session.status as any,
        paymentId: session.paymentId,
        metadata: session.metadata as any,
        updatedAt: session.updatedAt,
      },
      create: {
        id: session.id,
        storeId: session.storeId,
        amount: session.amount,
        currency: session.currency,
        description: session.description,
        checkoutToken: session.checkoutToken,
        expiresAt: session.expiresAt,
        successUrl: session.successUrl,
        cancelUrl: session.cancelUrl,
        metadata: session.metadata as any,
        status: session.status as any,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<DomainCheckoutSession | null> {
    const prismaSession = await this.prisma.checkoutSession.findUnique({
      where: { id },
    });

    if (!prismaSession) return null;
    return this.toDomain(prismaSession);
  }

  async findByToken(token: string): Promise<DomainCheckoutSession | null> {
    const prismaSession = await this.prisma.checkoutSession.findUnique({
      where: { checkoutToken: token },
    });

    if (!prismaSession) return null;
    return this.toDomain(prismaSession);
  }

  private toDomain(prismaSession: CheckoutSession): DomainCheckoutSession {
    return DomainCheckoutSession.create({
      id: prismaSession.id,
      storeId: prismaSession.storeId,
      amount: prismaSession.amount,
      currency: prismaSession.currency,
      description: prismaSession.description ?? undefined,
      paymentId: prismaSession.paymentId ?? undefined,
      checkoutToken: prismaSession.checkoutToken,
      status: prismaSession.status as any,
      expiresAt: prismaSession.expiresAt,
      successUrl: prismaSession.successUrl ?? undefined,
      cancelUrl: prismaSession.cancelUrl ?? undefined,
      metadata: (prismaSession.metadata as Record<string, unknown>) ?? undefined,
      createdAt: prismaSession.createdAt,
      updatedAt: prismaSession.updatedAt,
    });
  }
}
