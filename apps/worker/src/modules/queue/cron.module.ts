import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { QueueModule } from './queue.module';
import { SettlementJob } from '../../jobs/settlement.job';
import { CleanupLogsJob } from '../../jobs/cleanup-logs.job';
import { AntiFraudJob } from '../../jobs/anti-fraud.job';
import { OutboxDispatcherJob } from '../../jobs/outbox-dispatcher.job';
import { PaymentExpirationJob } from '../../jobs/payment-expiration.job';
import { CleanupIdempotencyKeysJob } from '../../jobs/cleanup-idempotency-keys.job';

/**
 * Cron Module
 *
 * Configures scheduled jobs (cron).
 */
@Module({
  imports: [CoreModule, QueueModule],
  providers: [
    SettlementJob,
    CleanupLogsJob,
    AntiFraudJob,
    OutboxDispatcherJob,
    PaymentExpirationJob,
    CleanupIdempotencyKeysJob,
  ],
  exports: [],
})
export class CronModule { }
