import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../infra/database/prisma.service';
import { PaymentStatus } from '@hockpay/database';
import { ReleasePaymentUseCase } from '@hockpay/core';

/**
 * Job que libera o saldo de pagamentos confirmados para a conta do merchant
 *
 * Roda diariamente à meia-noite
 */
@Injectable()
export class PaymentReleaseJob {
  private readonly logger = new Logger(PaymentReleaseJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly releasePaymentUseCase: ReleasePaymentUseCase,
  ) {}

  /**
   * Libera o saldo de pagamentos confirmados
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRelease(): Promise<void> {
    await this.releasePayments();
  }

  /**
   * Libera o saldo de pagamentos confirmados
   * Usa ReleasePaymentUseCase para garantir que eventos de outbox sejam criados
   */
  async releasePayments(): Promise<void> {
    this.logger.debug('Checking for payments to release...');

    // Busca stores com seus dias de settlement
    const stores = await this.prisma.store.findMany({
      where: {
        isActive: true,
        isApproved: true,
      },
    });

    let totalReleased = 0;

    for (const store of stores) {
      try {
        const settlementDays = store.settlementDays;
        const releaseDate = new Date();
        releaseDate.setDate(releaseDate.getDate() - settlementDays);

        // Busca pagamentos CONFIRMED prontos para liberação
        const paymentsToRelease = await this.prisma.payment.findMany({
          where: {
            storeId: store.id,
            status: PaymentStatus.CONFIRMED,
            paidAt: { lte: releaseDate },
          },
          take: 100,
        });

        if (paymentsToRelease.length === 0) {
          continue;
        }

        this.logger.log(`Releasing ${paymentsToRelease.length} payments for store ${store.id}`);

        for (const payment of paymentsToRelease) {
          try {
            const result = await this.releasePaymentUseCase.execute({
              paymentId: payment.id,
            });

            if (result.alreadyReleased) {
              this.logger.debug(`Payment ${payment.id} was already released`);
            } else {
              this.logger.debug(`Payment ${payment.id} released successfully`);
              totalReleased++;
            }
          } catch (error) {
            this.logger.error(`Failed to release payment ${payment.id}`, error);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to release payments for store ${store.id}`, error);
      }
    }

    if (totalReleased > 0) {
      this.logger.log(`Total payments released: ${totalReleased}`);
    }
  }
}
