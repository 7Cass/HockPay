import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../infra/database/prisma.service';
import { PaymentStatus } from '@hockpay/database';

/**
 * Job que expira pagamentos pendentes que passaram do prazo
 *
 * Roda a cada minuto
 */
@Injectable()
export class PaymentExpirationJob {
  private readonly logger = new Logger(PaymentExpirationJob.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Expira pagamentos pendentes que passaram do prazo
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiration(): Promise<void> {
    await this.expirePendingPayments();
  }

  /**
   * Expira pagamentos pendentes que passaram do prazo
   */
  async expirePendingPayments(): Promise<void> {
    this.logger.debug('Checking for expired payments...');

    const now = new Date();

    // Busca pagamentos PENDING que expiraram
    const expiredPayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        expiresAt: { lt: now },
      },
      take: 100,
    });

    if (expiredPayments.length === 0) {
      return;
    }

    this.logger.log(`Found ${expiredPayments.length} expired payments, expiring...`);

    for (const payment of expiredPayments) {
      try {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.EXPIRED },
        });

        // Cria outbox event
        await this.prisma.outboxEvent.create({
          data: {
            id: crypto.randomUUID(),
            aggregateType: 'Payment',
            aggregateId: payment.id,
            eventType: 'payment.expired',
            payload: {
              paymentId: payment.id,
              storeId: payment.storeId,
              amount: payment.amount,
              currency: payment.currency,
              expiredAt: now.toISOString(),
            },
            status: 'PENDING',
            processedAt: null,
            retryCount: 0,
            maxRetries: 5,
            nextRetryAt: new Date(),
            errorMessage: null,
            createdAt: now,
          },
        });

        this.logger.debug(`Payment ${payment.id} expired`);
      } catch (error) {
        this.logger.error(`Failed to expire payment ${payment.id}`, error);
      }
    }
  }
}
