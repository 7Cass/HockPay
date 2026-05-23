import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { RedisDistributedLockService } from './redis-distributed-lock.service';

interface RegisterWorkerCronJobInput {
  name: string;
  envName: string;
  defaultExpression: string;
  lockTtlMs?: number;
  onTick: () => Promise<void> | void;
}

@Injectable()
export class WorkerCronScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerCronScheduler.name);
  private readonly registeredJobNames = new Set<string>();

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    @Optional()
    private readonly distributedLock?: RedisDistributedLockService,
  ) {}

  registerCronJob(input: RegisterWorkerCronJobInput): void {
    const expression = this.resolveExpression(input.envName, input.defaultExpression);

    let job: CronJob;
    try {
      job = new CronJob(expression, () => {
        void this.runTick(input);
      });
    } catch (error) {
      throw new Error(
        `Invalid cron expression for ${input.envName} (${input.name}): "${expression}"`,
        { cause: error },
      );
    }

    this.schedulerRegistry.addCronJob(input.name, job);
    this.registeredJobNames.add(input.name);
    job.start();

    this.logger.log(`Registered cron job ${input.name} with ${input.envName}="${expression}"`);
  }

  onModuleDestroy(): void {
    for (const name of this.registeredJobNames) {
      try {
        this.schedulerRegistry.deleteCronJob(name);
      } catch (error) {
        this.logger.warn(`Failed to delete cron job ${name}`, error);
      }
    }
    this.registeredJobNames.clear();
  }

  private resolveExpression(envName: string, defaultExpression: string): string {
    return this.configService.get<string>(envName) ?? defaultExpression;
  }

  private async runTick(input: RegisterWorkerCronJobInput): Promise<void> {
    try {
      if (!this.distributedLock) {
        await input.onTick();
        return;
      }

      const lockKey = `hockpay:worker:cron:${input.name}:lock`;
      const lockTtlMs = input.lockTtlMs ?? this.resolveLockTtlMs();
      const lock = await this.distributedLock.tryAcquire(lockKey, lockTtlMs);

      if (!lock) {
        this.logger.warn(`Skipping cron job ${input.name}; distributed lock is held`);
        return;
      }

      try {
        await input.onTick();
      } finally {
        const released = await this.distributedLock.release(lock);
        if (!released) {
          this.logger.warn(
            `Distributed lock for cron job ${input.name} was not released; token no longer owns ${lockKey}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Cron job ${input.name} failed`, error);
    }
  }

  private resolveLockTtlMs(): number {
    const configured = this.configService.get<string>('WORKER_CRON_LOCK_TTL_MS');
    const parsed = configured ? Number(configured) : NaN;

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 60 * 1000;
  }
}
