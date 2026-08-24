import {
  ICheckoutSessionRepository,
  CheckoutSession as DomainCheckoutSession,
} from '@hockpay/core';
import { PrismaClient, Prisma, CheckoutSession } from '@hockpay/database';

export class CheckoutSessionRepository implements ICheckoutSessionRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async save(session: DomainCheckoutSession): Promise<void> {
    await this.prisma.checkoutSession.upsert({
      where: { id: session.id },
      update: {
        status: session.status as any,
        paymentId: session.paymentId,
        customerCollectionMode: session.customerCollectionMode as any,
        prefillCustomer: session.prefillCustomer as any,
        metadata: session.metadata as any,
        environment: session.environment as any,
        updatedAt: session.updatedAt,
      },
      create: {
        id: session.id,
        storeId: session.storeId,
        amount: session.amount,
        currency: session.currency,
        environment: session.environment as any,
        description: session.description,
        customerCollectionMode: session.customerCollectionMode as any,
        prefillCustomer: session.prefillCustomer as any,
        checkoutToken: session.checkoutToken,
        expiresAt: session.expiresAt,
        successUrl: session.successUrl,
        cancelUrl: session.cancelUrl,
        metadata: session.metadata as any,
        status: session.status as any,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        items: {
          create: session.items.map((item) => ({
            id: item.id ?? crypto.randomUUID(),
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
        },
      },
    });
  }

  async findById(id: string): Promise<DomainCheckoutSession | null> {
    const prismaSession = await this.prisma.checkoutSession.findUnique({
      where: { id },
      include: this.includeItems(),
    });

    if (!prismaSession) return null;
    return this.toDomain(prismaSession);
  }

  async findByToken(token: string): Promise<DomainCheckoutSession | null> {
    const prismaSession = await this.prisma.checkoutSession.findUnique({
      where: { checkoutToken: token },
      include: this.includeItems(),
    });

    if (!prismaSession) return null;
    return this.toDomain(prismaSession);
  }

  async claimOpenByToken(token: string, now: Date): Promise<DomainCheckoutSession | null> {
    const result = await this.prisma.checkoutSession.updateMany({
      where: {
        checkoutToken: token,
        status: 'OPEN' as any,
        paymentId: null,
        expiresAt: { gt: now },
      },
      data: {
        updatedAt: now,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findByToken(token);
  }

  async expireOpenByToken(token: string, now: Date): Promise<DomainCheckoutSession | null> {
    const result = await this.prisma.checkoutSession.updateMany({
      where: {
        checkoutToken: token,
        status: 'OPEN' as any,
        expiresAt: { lte: now },
      },
      data: {
        status: 'EXPIRED' as any,
        updatedAt: now,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findByToken(token);
  }

  async findByPaymentId(paymentId: string): Promise<DomainCheckoutSession | null> {
    const prismaSession = await this.prisma.checkoutSession.findUnique({
      where: { paymentId },
      include: this.includeItems(),
    });

    if (!prismaSession) return null;
    return this.toDomain(prismaSession);
  }

  private includeItems() {
    return { items: { orderBy: { createdAt: 'asc' as const } } };
  }

  private toDomain(prismaSession: CheckoutSession & { items?: any[] }): DomainCheckoutSession {
    return DomainCheckoutSession.create({
      id: prismaSession.id,
      storeId: prismaSession.storeId,
      amount: prismaSession.amount,
      currency: prismaSession.currency,
      environment: (prismaSession as any).environment,
      description: prismaSession.description ?? undefined,
      customerCollectionMode: prismaSession.customerCollectionMode as any,
      prefillCustomer: (prismaSession.prefillCustomer as Record<string, unknown>) ?? undefined,
      paymentId: prismaSession.paymentId ?? undefined,
      checkoutToken: prismaSession.checkoutToken,
      status: prismaSession.status as any,
      expiresAt: prismaSession.expiresAt,
      successUrl: prismaSession.successUrl ?? undefined,
      cancelUrl: prismaSession.cancelUrl ?? undefined,
      metadata: (prismaSession.metadata as Record<string, unknown>) ?? undefined,
      items: (prismaSession.items ?? []).map((item) => ({
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
      createdAt: prismaSession.createdAt,
      updatedAt: prismaSession.updatedAt,
    });
  }
}
