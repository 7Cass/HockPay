import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { SettlementJob } from '../../jobs/settlement.job';
import { CleanupLogsJob } from '../../jobs/cleanup-logs.job';
import { AntiFraudJob } from '../../jobs/anti-fraud.job';

/**
 * Cron Module
 *
 * Configures scheduled jobs (cron).
 */
@Module({
  imports: [CoreModule],
  providers: [
    SettlementJob,
    CleanupLogsJob,
    AntiFraudJob,
  ],
  exports: [],
})
export class CronModule {}
