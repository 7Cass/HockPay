import { Injectable, Logger, Inject, OnModuleInit, Optional } from '@nestjs/common';
import { IIdempotencyKeyRepository } from '@hockpay/core';
import { runExclusiveCronJob } from '../common/cron-guard';
import { WorkerCronScheduler } from '../common/worker-cron-scheduler';

/**
 * Cleanup Idempotency Keys Job
 *
 * Removes expired idempotency keys from the database to prevent infinite growth.
 * Runs daily at 4:00 AM.
 */
@Injectable()
export class CleanupIdempotencyKeysJob implements OnModuleInit {
    private readonly logger = new Logger(CleanupIdempotencyKeysJob.name);

    constructor(
        @Inject('IIdempotencyKeyRepository')
        private readonly repository: IIdempotencyKeyRepository,
        @Optional()
        private readonly cronScheduler?: WorkerCronScheduler,
    ) { }

    onModuleInit(): void {
        this.cronScheduler?.registerCronJob({
            name: CleanupIdempotencyKeysJob.name,
            envName: 'WORKER_CRON_CLEANUP_IDEMPOTENCY_KEYS',
            defaultExpression: '0 4 * * *',
            onTick: () => this.handleCleanup(),
        });
    }

    async handleCleanup(): Promise<void> {
        await runExclusiveCronJob(CleanupIdempotencyKeysJob.name, this.logger, async () => {
            this.logger.log('Starting idempotency keys cleanup job...');
            await this.runCleanup();
        });
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
