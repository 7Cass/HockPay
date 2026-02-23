import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IIdempotencyKeyRepository } from '@hockpay/core';

/**
 * Cleanup Idempotency Keys Job
 *
 * Removes expired idempotency keys from the database to prevent infinite growth.
 * Runs daily at 4:00 AM.
 */
@Injectable()
export class CleanupIdempotencyKeysJob {
    private readonly logger = new Logger(CleanupIdempotencyKeysJob.name);

    constructor(
        @Inject('IIdempotencyKeyRepository')
        private readonly repository: IIdempotencyKeyRepository,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_4AM)
    async handleCleanup(): Promise<void> {
        this.logger.log('Starting idempotency keys cleanup job...');
        await this.runCleanup();
    }

    async runCleanup(): Promise<void> {
        try {
            const deletedCount = await this.repository.deleteExpired();

            this.logger.log(`Cleanup completed: ${deletedCount} expired idempotency keys deleted`);
        } catch (error) {
            this.logger.error('Idempotency keys cleanup job failed:', error);
        }
    }
}
