import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ExpirePaymentUseCase, IPaymentRepository } from '@hockpay/core';
import { createWorkerRequestId } from '../common/request-id';
import { runExclusiveCronJob } from '../common/cron-guard';
import { WorkerCronScheduler } from '../common/worker-cron-scheduler';

@Injectable()
export class PaymentExpirationJob implements OnModuleInit {
  private readonly logger = new Logger(PaymentExpirationJob.name);

  constructor(
    @Inject('IPaymentRepository')
    private readonly paymentRepository: IPaymentRepository,
    private readonly expirePaymentUseCase: ExpirePaymentUseCase,
    @Optional()
    private readonly cronScheduler?: WorkerCronScheduler,
  ) {}

  onModuleInit(): void {
    this.cronScheduler?.registerCronJob({
      name: PaymentExpirationJob.name,
      envName: 'WORKER_CRON_PAYMENT_EXPIRATION',
      defaultExpression: '* * * * *',
      onTick: () => this.handleExpiration(),
    });
  }

  async handleExpiration(): Promise<void> {
    await runExclusiveCronJob(PaymentExpirationJob.name, this.logger, () =>
      this.expirePendingPayments(),
    );
  }

  async expirePendingPayments(): Promise<void> {
    this.logger.debug('Checking for expired payments...');

    const expiredPayments = await this.paymentRepository.findPendingExpired(new Date(), 100);

    if (expiredPayments.length === 0) {
      return;
    }

    this.logger.log(`Found ${expiredPayments.length} expired payments, expiring...`);

    for (const payment of expiredPayments) {
      const requestId = createWorkerRequestId('payment-expiration-scan', payment.id);
      try {
        const result = await this.expirePaymentUseCase.execute({
          storeId: payment.storeId,
          paymentId: payment.id,
          requestId,
          allowLiveEnvironment: true,
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
