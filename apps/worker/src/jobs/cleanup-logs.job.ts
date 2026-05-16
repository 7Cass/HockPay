import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { CleanupLogsUseCase } from '@hockpay/core';
import { runExclusiveCronJob } from '../common/cron-guard';
import { WorkerCronScheduler } from '../common/worker-cron-scheduler';

/**
 * Cleanup Logs Job
 *
 * Removes old webhook logs and processed outbox events.
 * Runs daily at 3:00 AM.
 */
@Injectable()
export class CleanupLogsJob implements OnModuleInit {
  private readonly logger = new Logger(CleanupLogsJob.name);

  constructor(
    private readonly cleanupLogsUseCase: CleanupLogsUseCase,
    @Optional()
    private readonly cronScheduler?: WorkerCronScheduler,
  ) {}

  onModuleInit(): void {
    this.cronScheduler?.registerCronJob({
      name: CleanupLogsJob.name,
      envName: 'WORKER_CRON_CLEANUP_LOGS',
      defaultExpression: '0 3 * * *',
      onTick: () => this.handleCleanup(),
    });
  }

  async handleCleanup(): Promise<void> {
    await runExclusiveCronJob(CleanupLogsJob.name, this.logger, async () => {
      this.logger.log('Starting cleanup job...');
      await this.runCleanup();
    });
  }

  async runCleanup(): Promise<void> {
    try {
      const result = await this.cleanupLogsUseCase.execute({
        webhookLogRetentionDays: 30,
        outboxRetentionDays: 30,
      });

      this.logger.log(
        `Cleanup completed: ${result.deletedWebhookLogs} webhook logs, ${result.deletedOutboxEvents} outbox events deleted`,
      );
    } catch (error) {
      this.logger.error('Cleanup job failed:', error);
    }
  }
}
