import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ReleasePaymentUseCase, PaymentStatus } from '@hockpay/core';
import { PrismaService } from '../infra/database/prisma.service';
import { createWorkerRequestId } from '../common/request-id';
import { runExclusiveCronJob } from '../common/cron-guard';
import { WorkerCronScheduler } from '../common/worker-cron-scheduler';

/**
 * Settlement Job
 *
 * Releases funds from confirmed payments to available balance.
 * Runs daily at midnight.
 */
@Injectable()
export class SettlementJob implements OnModuleInit {
  private readonly logger = new Logger(SettlementJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly releasePaymentUseCase: ReleasePaymentUseCase,
    @Optional()
    private readonly cronScheduler?: WorkerCronScheduler,
  ) {}

  onModuleInit(): void {
    this.cronScheduler?.registerCronJob({
      name: SettlementJob.name,
      envName: 'WORKER_CRON_SETTLEMENT',
      defaultExpression: '0 0 * * *',
      onTick: () => this.handleSettlement(),
    });
  }

  async handleSettlement(): Promise<void> {
    await runExclusiveCronJob(SettlementJob.name, this.logger, async () => {
      this.logger.log('Starting settlement job...');
      await this.processSettlements();
    });
  }

  async processSettlements(): Promise<void> {
    // Get all active and approved stores with their settlement days
    const stores = await this.prisma.store.findMany({
      where: {
        isActive: true,
        isApproved: true,
      },
    });

    let totalReleased = 0;
    let errors = 0;

    for (const store of stores) {
      try {
        const released = await this.processStorePayments(store.id, store.settlementDays);
        totalReleased += released;
      } catch (error) {
        this.logger.error(`Failed to process store ${store.id}:`, error);
        errors++;
      }
    }

    this.logger.log(`Settlement completed: ${totalReleased} payments released, ${errors} errors`);
  }

  private async processStorePayments(storeId: string, settlementDays: number): Promise<number> {
    const releaseDate = new Date();
    releaseDate.setDate(releaseDate.getDate() - settlementDays);

    // Find confirmed payments ready for release
    const payments = await this.prisma.payment.findMany({
      where: {
        storeId,
        status: PaymentStatus.CONFIRMED,
        paidAt: { lte: releaseDate },
      },
      take: 100,
    });

    if (payments.length === 0) {
      return 0;
    }

    this.logger.log(`Processing ${payments.length} payments for store ${storeId}`);

    let released = 0;
    for (const payment of payments) {
      const requestId = createWorkerRequestId('settlement', payment.id);
      try {
        await this.releasePaymentUseCase.execute({ storeId, paymentId: payment.id, requestId });
        released++;
      } catch (error) {
        this.logger.error(`Failed to release payment ${payment.id} requestId=${requestId}:`, error);
      }
    }

    return released;
  }
}
