import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../infra/database/prisma.service';
import { PaymentStatus } from '@hockpay/database';
import { ExpirePaymentUseCase } from '@hockpay/core';
import { createWorkerRequestId } from '../common/request-id';

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
    private readonly expirePaymentUseCase: ExpirePaymentUseCase,
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
   * Usa ExpirePaymentUseCase para garantir que eventos de outbox sejam criados
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
      const requestId = createWorkerRequestId('payment-expiration-scan', payment.id);
      try {
        const result = await this.expirePaymentUseCase.execute({
          paymentId: payment.id,
          requestId,
        });

        if (result.alreadyExpired) {
          this.logger.debug(`Payment ${payment.id} was already expired requestId=${requestId}`);
        } else {
          this.logger.debug(`Payment ${payment.id} expired successfully requestId=${requestId}`);
        }
      } catch (error) {
        this.logger.error(`Failed to expire payment ${payment.id} requestId=${requestId}`, error);
      }
    }
  }
}
