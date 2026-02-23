import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../infra/database/prisma.service';
import { PaymentStatus } from '@hockpay/database';

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
   */
  async releasePayments(): Promise<void> {
    this.logger.debug('Checking for payments to release...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // D+30

    // Busca stores com seus dias de settlement
    const stores = await this.prisma.store.findMany({
      where: {
        isActive: true,
        isApproved: true,
      },
      include: {
        account: true,
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
          await this.releasePayment(payment, store);
          totalReleased++;
        }
      } catch (error) {
        this.logger.error(`Failed to release payments for store ${store.id}`, error);
      }
    }

    if (totalReleased > 0) {
      this.logger.log(`Total payments released: ${totalReleased}`);
    }
  }

  /**
   * Libera um pagamento específico
   */
  private async releasePayment(payment: any, store: any): Promise<void> {
    try {
      // Atualiza o status do pagamento
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.RELEASED,
          releasedAt: new Date(),
        },
      });

      // Cria uma transação para liberar o saldo
      const accountId = store.account?.id;
      if (accountId) {
        await this.prisma.$transaction([
          // Atualiza o balance pendente -> disponível
          this.prisma.account.update({
            where: { id: accountId },
            data: {
              pending: { decrement: payment.netAmount },
              available: { increment: payment.netAmount },
            },
          }),
          // Cria registro de transação
          this.prisma.transaction.create({
            data: {
              id: crypto.randomUUID(),
              accountId,
              type: 'PAYMENT_RELEASED',
              amount: payment.netAmount,
              fee: 0,
              netAmount: payment.netAmount,
              balanceAfter: (store.account.available + payment.netAmount),
              referenceType: 'Payment',
              referenceId: payment.id,
              description: `Release of payment ${payment.id}`,
              createdAt: new Date(),
            },
          }),
        ]);
      }

      // Cria outbox event
      await this.prisma.outboxEvent.create({
        data: {
          id: crypto.randomUUID(),
          aggregateType: 'Payment',
          aggregateId: payment.id,
          eventType: 'payment.released',
          payload: {
            paymentId: payment.id,
            storeId: payment.storeId,
            accountId,
            amount: payment.netAmount,
            currency: payment.currency,
            releasedAt: new Date().toISOString(),
          },
          status: 'PENDING',
          processedAt: null,
          retryCount: 0,
          maxRetries: 5,
          nextRetryAt: new Date(),
          errorMessage: null,
          createdAt: new Date(),
        },
      });

      this.logger.debug(`Payment ${payment.id} released`);
    } catch (error) {
      this.logger.error(`Failed to release payment ${payment.id}`, error);
    }
  }
}
