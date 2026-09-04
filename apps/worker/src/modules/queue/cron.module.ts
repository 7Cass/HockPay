import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { QueueModule } from './queue.module';
import { SettlementJob } from '../../jobs/settlement.job';
import { CleanupLogsJob } from '../../jobs/cleanup-logs.job';
import { OutboxDispatcherJob } from '../../jobs/outbox-dispatcher.job';
import { PaymentExpirationJob } from '../../jobs/payment-expiration.job';
import { CleanupIdempotencyKeysJob } from '../../jobs/cleanup-idempotency-keys.job';
import { WithdrawalProcessingJob } from '../../jobs/withdrawal-processing.job';
import { WorkerCronScheduler } from '../../common/worker-cron-scheduler';
import { RedisDistributedLockService } from '../../common/redis-distributed-lock.service';

/**
 * Cron Module
 *
 * Configures scheduled jobs (cron).
 */
@Module({
  imports: [CoreModule, QueueModule],
  providers: [
    RedisDistributedLockService,
    WorkerCronScheduler,
    SettlementJob,
    CleanupLogsJob,
    OutboxDispatcherJob,
    PaymentExpirationJob,
    CleanupIdempotencyKeysJob,
    WithdrawalProcessingJob,
  ],
  exports: [],
})
export class CronModule {}
