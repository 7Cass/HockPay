import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { DetectAnomaliesUseCase } from '@hockpay/core';
import { runExclusiveCronJob } from '../common/cron-guard';
import { WorkerCronScheduler } from '../common/worker-cron-scheduler';

/**
 * Anti-Fraud Job
 *
 * Detects suspicious activity and anomalies.
 * Runs every hour.
 */
@Injectable()
export class AntiFraudJob implements OnModuleInit {
  private readonly logger = new Logger(AntiFraudJob.name);

  constructor(
    private readonly detectAnomaliesUseCase: DetectAnomaliesUseCase,
    @Optional()
    private readonly cronScheduler?: WorkerCronScheduler,
  ) {}

  onModuleInit(): void {
    this.cronScheduler?.registerCronJob({
      name: AntiFraudJob.name,
      envName: 'WORKER_CRON_ANTI_FRAUD',
      defaultExpression: '0 * * * *',
      onTick: () => this.handleAntiFraud(),
    });
  }

  async handleAntiFraud(): Promise<void> {
    await runExclusiveCronJob(AntiFraudJob.name, this.logger, async () => {
      this.logger.log('Starting anti-fraud scan...');
      await this.runAntiFraudScan();
    });
  }

  async runAntiFraudScan(): Promise<void> {
    try {
      const result = await this.detectAnomaliesUseCase.execute({
        timeWindowHours: 1,
        volumeThreshold: 100,
        failureRateThreshold: 0.5,
      });

      if (result.stub) {
        this.logger.warn('Anti-fraud stub: scan not implemented');
        return;
      }

      if (result.anomalies.length > 0) {
        this.logger.warn(`Detected ${result.anomalies.length} anomalies`);
      } else {
        this.logger.log('Anti-fraud scan completed: no anomalies detected');
      }
    } catch (error) {
      this.logger.error('Anti-fraud scan failed:', error);
    }
  }
}
