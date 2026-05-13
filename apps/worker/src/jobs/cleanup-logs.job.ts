import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CleanupLogsUseCase } from '@hockpay/core';
import { runExclusiveCronJob } from '../common/cron-guard';

/**
 * Cleanup Logs Job
 *
 * Removes old webhook logs and processed outbox events.
 * Runs daily at 3:00 AM.
 */
@Injectable()
export class CleanupLogsJob {
  private readonly logger = new Logger(CleanupLogsJob.name);

  constructor(private readonly cleanupLogsUseCase: CleanupLogsUseCase) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
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
